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

// 1. BUSCA HÍBRIDA (MySQL + ODBC)
app.get("/api/funcionarios", async (req, res) => {
    const busca = req.query.busca;
    if (!busca) return res.json([]);

    let connectionODBC;
    let connectionMySQL;
    let resultadosFinais = [];

    try {
        // --- BUSCA NO MYSQL ---
        connectionMySQL = await mysql.createConnection(dbConfig);
        const [rowsMysql] = await connectionMySQL.execute(
            `SELECT matricula, nome, cargo, setor, turno, DATE_FORMAT(inicio, '%d/%m/%Y') as dataInicio 
             FROM funcionarios 
             WHERE nome LIKE ? OR matricula = ?`,
            [`%${busca}%`, busca]
        );
        resultadosFinais = [...rowsMysql];

        // --- BUSCA NO TOTVS (ODBC) ---
        try {
            connectionODBC = await odbc.connect(totvsConfig);
            let sqlTotvs = `SELECT ul.des_unid_lotac AS "setor", cg.des_cargo, fc.cdn_funcionario, fc.dat_admis_func, fc.nom_pessoa_fisic
                           FROM hcm.PUB."funcionario" AS fc
                           INNER JOIN hcm.PUB.cargo AS cg ON cg.cdn_cargo_basic = fc.cdn_cargo_basic
                           INNER JOIN hcm.PUB.unid_lotac AS ul ON ul.cod_unid_lotac = fc.cod_unid_lotac
                           WHERE fc.nom_pessoa_fisic LIKE ? OR fc.cdn_funcionario = ?`;
            
            const resultTotvs = await connectionODBC.query(sqlTotvs, [`%${busca.toUpperCase()}%`, isNaN(busca) ? -1 : parseInt(busca)]);
            
            const formatadosTotvs = resultTotvs.map(row => ({
                matricula: String(row.cdn_funcionario),
                nome: row.nom_pessoa_fisic,
                cargo: row.des_cargo,
                setor: row.setor,
                turno: "1º Turno",
                dataInicio: row.dat_admis_func ? new Date(row.dat_admis_func).toLocaleDateString('pt-BR') : '-'
            }));
            
            resultadosFinais = [...resultadosFinais, ...formatadosTotvs];
        } catch (errOdbc) {
            console.error("ODBC Indisponível, usando apenas MySQL.");
        }

        const uniqueMap = new Map();
        resultadosFinais.forEach(emp => uniqueMap.set(emp.matricula, emp));
        res.json(Array.from(uniqueMap.values()));

    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } finally { 
        if (connectionODBC) await connectionODBC.close(); 
        if (connectionMySQL) await connectionMySQL.end();
    }
});

// 2. CADASTRO DE NOVO FUNCIONÁRIO (MySQL)
app.post("/api/funcionarios/novo", async (req, res) => {
    const { matricula, nome, cargo, setor, turno, inicio } = req.body;
    let connection;

    if (!matricula || !nome || !cargo || !setor) {
        return res.status(400).json({ error: "Matrícula, Nome, Cargo e Setor são obrigatórios." });
    }

    try {
        connection = await mysql.createConnection(dbConfig);
        const [existe] = await connection.execute("SELECT id FROM funcionarios WHERE matricula = ?", [matricula]);
        if (existe.length > 0) {
            return res.status(400).json({ error: "Esta matrícula já está cadastrada no sistema." });
        }

        await connection.execute(
            `INSERT INTO funcionarios (matricula, nome, cargo, setor, turno, inicio) VALUES (?, ?, ?, ?, ?, ?)`,
            [matricula, nome, cargo, setor, turno, inicio || null]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        if (connection) await connection.end();
    }
});

// 3. SALVAR ENTREGA EPI
app.post("/api/entregas", async (req, res) => {
    const { funcionario, ficha } = req.body;
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        await connection.beginTransaction();

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

// 4. HISTÓRICO
app.get("/api/funcionarios/:matricula/epis", async (req, res) => {
    const { matricula } = req.params;
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(
            `SELECT e.epi_recebido, e.data_retirada, e.ca, e.qtde, e.modelo, e.data_devolucao, e.assinatura
             FROM entregas_epi e
             JOIN funcionarios f ON f.id = e.funcionario_id
             WHERE f.matricula = ? ORDER BY e.id DESC`, [matricula]
        );
        res.json(rows.map(row => ({
            epi: row.epi_recebido,
            qtde: row.qtde,
            modelo: row.modelo,
            ca: row.ca,
            dataRetirada: row.data_retirada ? new Date(row.data_retirada).toLocaleDateString('pt-BR') : '-',
            dataDevolucao: row.data_devolucao ? new Date(row.data_devolucao).toLocaleDateString('pt-BR') : '-',
            assinatura: row.assinatura ? `data:image/png;base64,${row.assinatura.toString('base64')}` : null
        })));
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } finally { 
        if (connection) await connection.end(); 
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando em http://localhost:${PORT}`));