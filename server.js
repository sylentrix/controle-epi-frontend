const express = require("express");
const odbc = require("odbc");
const cors = require("cors");

const app = express();
app.use(cors()); 
app.use(express.json());

// --- ESTA LINHA É A CHAVE ---
// Ela faz o servidor mostrar o seu index.html automaticamente
app.use(express.static(__dirname));

// String de conexão com o seu DSN
const connectionString = "DSN=Conexao_TOTVS;UID=sysprogress;PWD=sysprogress"; 

// 1. ROTA DE BUSCA DE FUNCIONÁRIOS
app.get("/api/funcionarios", async (req, res) => {
    const busca = req.query.busca;
    let connection;

    try {
        connection = await odbc.connect(connectionString);
        let sql = `SELECT FIRST 20 cdn_funcionario, dat_admis_func, nom_pessoa_fisic FROM hcm.PUB."funcionario"`;

        if (busca) {
            if (!isNaN(busca)) {
                sql = `SELECT cdn_funcionario, dat_admis_func, nom_pessoa_fisic FROM hcm.PUB."funcionario" WHERE cdn_funcionario = ${busca}`;
            } else {
                sql = `SELECT cdn_funcionario, dat_admis_func, nom_pessoa_fisic FROM hcm.PUB."funcionario" WHERE nom_pessoa_fisic LIKE '%${busca.toUpperCase()}%'`;
            }
        }

        const result = await connection.query(sql);
        const funcionarios = result.map(row => ({
            matricula: row.cdn_funcionario,
            nome: row.nom_pessoa_fisic,
            cargo: "Consultar no RH",
            setor: "Geral",
            turno: "1º Turno",
            dataInicio: row.dat_admis_func ? new Date(row.dat_admis_func).toLocaleDateString('pt-BR') : '-'
        }));
        res.json(funcionarios);
    } catch (error) {
        console.error("Erro no Banco:", error);
        res.status(500).json({ error: "Erro ao consultar o banco TOTVS" });
    } finally {
        if (connection) await connection.close();
    }
});

// 2. ROTA DE EPIS (Simulada por enquanto)
app.get("/api/funcionarios/:matricula/epis", async (req, res) => {
    res.json([
        { id: 1, nomeEPI: "Protetor Auricular", entregue: false, dataEntrega: "", validade: "31/12/2025" },
        { id: 2, nomeEPI: "Luva de Raspa", entregue: true, dataEntrega: "10/01/2024", validade: "15/05/2024" }
    ]);
});

// INICIAR SERVIDOR
app.listen(3000, () => {
    console.log("🚀 Servidor rodando em http://localhost:3000");
    console.log("👉 Abra no navegador: http://localhost:3000");
});