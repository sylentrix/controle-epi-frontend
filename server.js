require('dotenv').config();
const express = require("express");
const odbc = require("odbc");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

const totvsConfig = process.env.TOTVS_CONNECTION;
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
};

function brDateToSql(dateStr) {
    if (!dateStr || dateStr === '-') return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateStr;
}

// ─────────────────────────────────────────────────────────────
// BUSCA NO MYSQL (isolada — nunca bloqueia a busca no ODBC)
// ─────────────────────────────────────────────────────────────
async function buscarNoMySQL(busca) {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(
            `SELECT matricula, nome, cargo, setor, turno,
                    DATE_FORMAT(inicio, '%d/%m/%Y') AS dataInicio
             FROM funcionarios
             WHERE nome LIKE ? OR matricula = ?`,
            [`%${busca}%`, busca]
        );
        console.log(`[MySQL] ${rows.length} resultado(s) para "${busca}"`);
        return { resultados: rows, erro: null };
    } catch (e) {
        console.error("[MySQL] Erro na busca:", e.message);
        return { resultados: [], erro: e.message };
    } finally {
        if (connection) await connection.end();
    }
}

// ─────────────────────────────────────────────────────────────
// BUSCA NO TOTVS/ODBC (isolada — nunca bloqueia a busca no MySQL)
// ─────────────────────────────────────────────────────────────
async function buscarNoODBC(busca) {
    let connectionODBC;
    try {
        connectionODBC = await odbc.connect(totvsConfig);
        const sql = `
            SELECT ul.des_unid_lotac AS setor,
                   cg.des_cargo,
                   fc.cdn_funcionario,
                   fc.dat_admis_func,
                   fc.nom_pessoa_fisic
            FROM hcm.PUB."funcionario" AS fc
            INNER JOIN hcm.PUB.cargo    AS cg ON cg.cdn_cargo_basic  = fc.cdn_cargo_basic
            INNER JOIN hcm.PUB.unid_lotac AS ul ON ul.cod_unid_lotac = fc.cod_unid_lotac
            WHERE fc.nom_pessoa_fisic LIKE ?
               OR fc.cdn_funcionario  = ?`;

        const matriculaParam = isNaN(busca) ? -1 : parseInt(busca);
        const rows = await connectionODBC.query(sql, [`%${busca.toUpperCase()}%`, matriculaParam]);

        // Log das chaves reais retornadas pelo driver ODBC (ajuda a depurar aliases)
        if (rows.length > 0) {
            console.log('[ODBC/TOTVS] Colunas retornadas:', Object.keys(rows[0]));
        }

        const formatados = rows.map(row => ({
            matricula:  String(row.cdn_funcionario),
            nome:       row.nom_pessoa_fisic,
            cargo:      row.des_cargo   || row.DES_CARGO   || '-',
            // Drivers ODBC podem retornar o alias em minúsculo, maiúsculo
            // ou ignorar o alias e usar o nome original da coluna
            setor:      row.setor       || row.SETOR
                     || row.des_unid_lotac || row.DES_UNID_LOTAC || '-',
            turno:      "1º Turno",
            dataInicio: row.dat_admis_func
                            ? new Date(row.dat_admis_func).toLocaleDateString('pt-BR')
                            : '-',
            origem:     'TOTVS'
        }));

        console.log(`[ODBC/TOTVS] ${formatados.length} resultado(s) para "${busca}"`);
        return { resultados: formatados, erro: null };
    } catch (e) {
        console.error("[ODBC/TOTVS] Indisponível ou erro:", e.message);
        return { resultados: [], erro: e.message };
    } finally {
        if (connectionODBC) await connectionODBC.close();
    }
}

// ─────────────────────────────────────────────────────────────
// 1. BUSCA SEQUENCIAL — TOTVS primeiro; MySQL só se TOTVS não encontrar
//
// Fluxo:
//   1. Busca no TOTVS (ODBC)
//      → achou         : retorna resultado com origem='TOTVS'
//      → não achou / indisponível: vai para passo 2
//   2. Busca no MySQL
//      → achou         : retorna resultado com origem='MySQL'
//      → não achou         : lista vazia → frontend exibe botão de inserir
// ─────────────────────────────────────────────────────────────
app.get("/api/funcionarios", async (req, res) => {
    const busca = (req.query.busca || "").trim();
    if (!busca) return res.json({ resultados: [], fontes: {} });

    // ── PASSO 1: TOTVS ───────────────────────────────────────────
    const resODBC = await buscarNoODBC(busca);

    if (resODBC.resultados.length > 0) {
        console.log(`[Busca] Encontrado no TOTVS. MySQL não consultado.`);
        return res.json({
            resultados: resODBC.resultados,
            fontes: {
                odbc:  { ok: true, erro: null, consultado: true  },
                mysql: { ok: true, erro: null, consultado: false }
            }
        });
    }

    // ── PASSO 2: MySQL (TOTVS vazio ou indisponível) ─────────────────
    const motivo = resODBC.erro
        ? `TOTVS indisponível (${resODBC.erro})`
        : `TOTVS não encontrou resultados`;
    console.log(`[Busca] ${motivo}. Consultando MySQL...`);

    const resMySQL = await buscarNoMySQL(busca);

    // ── PASSO 3: responde — [] = frontend pede inserção ──────────────
    return res.json({
        resultados: resMySQL.resultados,
        fontes: {
            odbc:  { ok: resODBC.erro  === null, erro: resODBC.erro,  consultado: true },
            mysql: { ok: resMySQL.erro === null, erro: resMySQL.erro, consultado: true }
        }
    });
});

// ─────────────────────────────────────────────────────────────
// 2. CADASTRO DE NOVO FUNCIONÁRIO (MySQL)
// Tabela: funcionarios (id AI PK, matricula varchar30, nome varchar120,
//          cargo varchar120, inicio date, setor varchar120, turno varchar60,
//          created_at timestamp, updated_at timestamp)
// ─────────────────────────────────────────────────────────────
app.post("/api/funcionarios/novo", async (req, res) => {
    const { matricula, nome, cargo, setor, turno, inicio } = req.body;
    let connection;

    // Validação — todos os campos marcados com * no formulário
    const faltando = [];
    if (!matricula || String(matricula).trim() === '') faltando.push('matricula');
    if (!nome      || nome.trim()      === '')         faltando.push('nome');
    if (!cargo     || cargo.trim()     === '')         faltando.push('cargo');
    if (!setor     || setor.trim()     === '')         faltando.push('setor');
    if (!turno     || turno.trim()     === '')         faltando.push('turno');

    if (faltando.length > 0) {
        return res.status(400).json({
            error: `Campos obrigatórios não preenchidos: ${faltando.join(', ')}.`
        });
    }

    try {
        connection = await mysql.createConnection(dbConfig);

        // Verifica duplicidade de matrícula
        const [existe] = await connection.execute(
            "SELECT id FROM funcionarios WHERE matricula = ?",
            [String(matricula).trim()]
        );
        if (existe.length > 0) {
            return res.status(400).json({ error: `A matrícula "${matricula}" já está cadastrada no sistema.` });
        }

        await connection.execute(
            `INSERT INTO funcionarios (matricula, nome, cargo, setor, turno, inicio)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                String(matricula).trim(),
                nome.trim(),
                cargo.trim(),
                setor.trim(),
                turno.trim(),
                inicio || null          // date ou NULL — created_at/updated_at são automáticos
            ]
        );

        res.json({ success: true, message: `Funcionário "${nome.trim()}" cadastrado com sucesso.` });
    } catch (e) {
        console.error("[POST /funcionarios/novo]", e.message);
        res.status(500).json({ error: e.message });
    } finally {
        if (connection) await connection.end();
    }
});

// ─────────────────────────────────────────────────────────────
// 3. SALVAR ENTREGA EPI
// ─────────────────────────────────────────────────────────────
app.post("/api/entregas", async (req, res) => {
    const { funcionario, ficha } = req.body;
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        await connection.beginTransaction();

        // Upsert do funcionário (garante que existe no MySQL mesmo vindo do TOTVS)
        await connection.execute(
            `INSERT INTO funcionarios (matricula, nome, cargo, setor, turno, inicio)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               nome   = VALUES(nome),
               cargo  = VALUES(cargo),
               setor  = VALUES(setor),
               turno  = VALUES(turno),
               inicio = VALUES(inicio)`,
            [
                funcionario.matricula,
                funcionario.nome,
                funcionario.cargo,
                funcionario.setor,
                funcionario.turno,
                brDateToSql(funcionario.dataInicio)
            ]
        );

        const [rows] = await connection.execute(
            "SELECT id FROM funcionarios WHERE matricula = ?", [funcionario.matricula]
        );
        const funcionarioId = rows[0].id;

        const base64Data     = ficha.assinaturaBase64.replace(/^data:image\/\w+;base64,/, "");
        const bufferAssinatura = Buffer.from(base64Data, 'base64');

        await connection.execute(
            `INSERT INTO entregas_epi
               (funcionario_id, epi_recebido, qtde, modelo, ca, data_retirada, data_devolucao, assinatura)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                funcionarioId,
                ficha.epi,
                ficha.qtde,
                ficha.modelo,
                ficha.ca,
                ficha.dataRetirada,
                ficha.dataDevolucao || null,
                bufferAssinatura
            ]
        );

        await connection.commit();
        res.json({ success: true });
    } catch (e) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: e.message });
    } finally {
        if (connection) await connection.end();
    }
});

// ─────────────────────────────────────────────────────────────
// 4. HISTÓRICO DE EPIs
// ─────────────────────────────────────────────────────────────
app.get("/api/funcionarios/:matricula/epis", async (req, res) => {
    const { matricula } = req.params;
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(
            `SELECT e.epi_recebido, e.data_retirada, e.ca, e.qtde,
                    e.modelo, e.data_devolucao, e.assinatura
             FROM entregas_epi e
             JOIN funcionarios f ON f.id = e.funcionario_id
             WHERE f.matricula = ?
             ORDER BY e.id DESC`,
            [matricula]
        );
        res.json(rows.map(row => ({
            epi:          row.epi_recebido,
            qtde:         row.qtde,
            modelo:       row.modelo,
            ca:           row.ca,
            dataRetirada: row.data_retirada
                            ? new Date(row.data_retirada).toLocaleDateString('pt-BR') : '-',
            dataDevolucao: row.data_devolucao
                            ? new Date(row.data_devolucao).toLocaleDateString('pt-BR') : '-',
            assinatura:   row.assinatura
                            ? `data:image/png;base64,${row.assinatura.toString('base64')}` : null
        })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        if (connection) await connection.end();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando em http://localhost:${PORT}`));
