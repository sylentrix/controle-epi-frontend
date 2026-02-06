// js/main.js
document.getElementById('btnSearch').addEventListener('click', performSearch);

// Permite dar 'Enter' no campo de busca
document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

async function performSearch() {
    const query = document.getElementById('searchInput').value;
    const loading = document.getElementById('loading');
    const tableBody = document.getElementById('employeeBody');
    const messageArea = document.getElementById('messageArea');

    if (!query) return alert("Digite um nome ou matrícula para pesquisar");

    // Limpa a tela e mostra 'Carregando'
    loading.classList.remove('hidden');
    tableBody.innerHTML = '';
    messageArea.classList.add('hidden');

    try {
        // ApiService está no seu arquivo api.js
        const employees = await ApiService.searchEmployees(query);

        if (employees.length === 0) {
            messageArea.innerText = "Nenhum funcionário encontrado.";
            messageArea.classList.remove('hidden');
        } else {
            employees.forEach(emp => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${emp.matricula}</td>
                    <td>${emp.nome}</td>
                    <td>${emp.cargo}</td>
                    <td>${emp.setor}</td>
                    <td>${emp.turno}</td>
                    <td>${emp.dataInicio}</td>
                `;
                // Ao clicar na linha, abre o modal (que está no modal.js)
                row.onclick = () => openEpiModal(emp);
                tableBody.appendChild(row);
            });
        }
    } catch (error) {
        console.error(error);
        messageArea.innerText = "Erro na conexão com o servidor.";
        messageArea.classList.remove('hidden');
    } finally {
        loading.classList.add('hidden');
    }
}