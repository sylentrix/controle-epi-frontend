// js/api.js
const API_BASE_URL = "http://localhost:3000/api"; 

const ApiService = {
    async searchEmployees(query) {
        const response = await fetch(`${API_BASE_URL}/funcionarios?busca=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Erro ao buscar funcionários");
        return await response.json();
    },

    async getEmployeeEPIs(matricula) {
        const response = await fetch(`${API_BASE_URL}/funcionarios/${matricula}/epis`);
        if (!response.ok) return [];
        return await response.json();
    },

    async registerDelivery(matricula, epiId) {
        const response = await fetch(`${API_BASE_URL}/epis/entrega`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matricula, epiId, dataEntrega: new Date().toISOString() })
        });
        return await response.json();
    }
};