const express = require("express");
const odbc = require("odbc");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Para suportar o Base64 da assinatura
app.use(express.static(__dirname));

// --- CONFIGURAÇÕES DE CONEXÃO ---
const totvsConfig = "DSN=Conexao_TOTVS;UID=sysprogress;PWD=sysprogress";

const dbConfig = {
    host: 'n8n-database.cukk4sxofq6l.sa-east-1.rds.amazonaws.com',
    user: 'root',
    password: 'Flowabril202',
    database: 'controle_epi'
};

// Helper: Converte "10/02/2024" para "2024-02-10"
function brDateToSql(dateStr) {
    if (!dateStr || dateStr === '-') return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateStr;
}

// 1. BUSCA NO TOTVS (Via ODBC)
app.get("/api/funcionarios", async (req, res) => {
    const busca = req.query.busca;
    let connection;
    try {
        connection = await odbc.connect(totvsConfig);
        let sql = `SELECT ul.des_unid_lotac AS "setor", cg.des_cargo, fc.cdn_funcionario, fc.dat_admis_func, fc.nom_pessoa_fisic
                   FROM hcm.PUB."funcionario" AS fc
                   INNER JOIN hcm.PUB.cargo AS cg ON cg.cdn_cargo_basic = fc.cdn_cargo_basic
                   INNER JOIN hcm.PUB.unid_lotac AS ul ON ul.cod_unid_lotac = fc.cod_unid_lotac`;
        
        let result;
        if (busca) {
            if (!isNaN(busca)) {
                result = await connection.query(sql + " WHERE fc.cdn_funcionario = ?", [parseInt(busca)]);
            } else {
                result = await connection.query(sql + " WHERE fc.nom_pessoa_fisic LIKE ?", [`%${busca.toUpperCase()}%`]);
            }
        } else {
            result = await connection.query(`SELECT FIRST 20 * FROM (${sql}) AS sub`);
        }

        res.json(result.map(row => ({
            matricula: String(row.cdn_funcionario),
            nome: row.nom_pessoa_fisic,
            cargo: row.des_cargo,
            setor: row.setor,
            turno: "1º Turno",
            dataInicio: row.dat_admis_func ? new Date(row.dat_admis_func).toLocaleDateString('pt-BR') : '-'
        })));
    } catch (e) { res.status(500).send(e.message); }
    finally { if (connection) await connection.close(); }
});

// 2. SALVAR NO MYSQL (Upsert Funcionário + Insert Entrega)
app.post("/api/entregas", async (req, res) => {
    const { funcionario, ficha } = req.body;
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        await connection.beginTransaction();

        // UPSERT do Funcionário
        await connection.execute(
            `INSERT INTO funcionarios (matricula, nome, cargo, setor, turno, inicio)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE nome=?, cargo=?, setor=?, turno=?, inicio=?`,
            [
                funcionario.matricula, funcionario.nome, funcionario.cargo, funcionario.setor, funcionario.turno, brDateToSql(funcionario.dataInicio),
                funcionario.nome, funcionario.cargo, funcionario.setor, funcionario.turno, brDateToSql(funcionario.dataInicio)
            ]
        );

        const [rows] = await connection.execute("SELECT id FROM funcionarios WHERE matricula = ?", [funcionario.matricula]);
        const funcionarioId = rows[0].id;

        // Converter Assinatura Base64 para Buffer (Blob)
        const base64Data = ficha.assinaturaBase64.replace(/^data:image\/\w+;base64,/, "");
        const bufferAssinatura = Buffer.from(base64Data, 'base64');

        await connection.execute(
            `INSERT INTO entregas_epi (funcionario_id, epi_recebido, qtde, modelo, ca, data_retirada, data_devolucao, assinatura)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [funcionarioId, ficha.epi, ficha.qtde, ficha.modelo, ficha.ca, ficha.dataRetirada, ficha.dataDevolucao || null, bufferAssinatura]
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

// 3. BUSCAR HISTÓRICO NO MYSQL
app.get("/api/funcionarios/:matricula/epis", async (req, res) => {
    const { matricula } = req.params;
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(
            `SELECT e.epi_recebido, e.data_retirada, e.ca, e.qtde
             FROM entregas_epi e
             JOIN funcionarios f ON f.id = e.funcionario_id
             WHERE f.matricula = ? ORDER BY e.id DESC`, [matricula]
        );
        res.json(rows.map(row => ({
            nomeEPI: row.epi_recebido,
            dataEntrega: row.data_retirada ? new Date(row.data_retirada).toLocaleDateString('pt-BR') : '-',
            ca: row.ca,
            qtde: row.qtde
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
    finally { if (connection) await connection.end(); }
});

app.listen(3000, () => console.log("🚀 Servidor rodando em http://localhost:3000"));