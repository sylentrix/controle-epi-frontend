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

    loading.classList.remove('hidden');
    tableBody.innerHTML = '';
    messageArea.classList.add('hidden');

    try {
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
                    <td><button class="btn-report" title="Gerar Relatório">📄</button></td>
                `;
                
                // Clique na linha abre o histórico
                row.onclick = (e) => {
                    if(e.target.tagName !== 'BUTTON') openEpiModal(emp);
                };

                // Clique no botão de relatório
                row.querySelector('.btn-report').onclick = (e) => {
                    e.stopPropagation(); // Impede de abrir o modal de histórico junto
                    openReportModal(emp);
                };

                tableBody.appendChild(row); // PRECISA estar dentro do forEach
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