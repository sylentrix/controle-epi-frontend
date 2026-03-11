const API_BASE_URL = "http://localhost:3000/api";

const ApiService = {

    // Retorna { resultados: [...], fontes: { mysql, odbc } }
    async searchEmployees(query) {
        const response = await fetch(`${API_BASE_URL}/funcionarios?busca=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Erro ao buscar funcionários");
        return await response.json(); // objeto completo, não apenas o array
    },

    async registerEmployee(data) {
        const response = await fetch(`${API_BASE_URL}/funcionarios/novo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Erro ao cadastrar funcionário");
        }
        return await response.json();
    },

    async saveFicha(payload) {
        const response = await fetch(`${API_BASE_URL}/entregas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Erro ao salvar");
        }
        return await response.json();
    },

    async getEmployeeEPIs(matricula) {
        const response = await fetch(`${API_BASE_URL}/funcionarios/${matricula}/epis`);
        if (!response.ok) return [];
        return await response.json();
    },

    async getTermo(matricula) {
        const response = await fetch(`${API_BASE_URL}/funcionarios/${matricula}/termo`);
        if (!response.ok) return { assinou: false };
        return await response.json();
    },

    async saveTermo(matricula, funcionario, assinaturaBase64) {
        const response = await fetch(`${API_BASE_URL}/funcionarios/${matricula}/termo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ funcionario, assinaturaBase64 })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Erro ao salvar assinatura do termo");
        }
        return await response.json();
    }
};
