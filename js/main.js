document.getElementById('btnSearch').addEventListener('click', performSearch);

document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

async function performSearch() {
    const query = document.getElementById('searchInput').value;
    const loading = document.getElementById('loading');
    const tableBody = document.getElementById('employeeBody');
    const messageArea = document.getElementById('messageArea');
    const noResultsArea = document.getElementById('noResultsArea');

    if (!query) return alert("Digite um nome ou matrícula para pesquisar");

    // Reset de tela
    loading.classList.remove('hidden');
    tableBody.innerHTML = '';
    messageArea.classList.add('hidden');
    noResultsArea.classList.add('hidden'); // Esconde o botão de adicionar no início da busca

    try {
        const employees = await ApiService.searchEmployees(query);
        console.log("Funcionários encontrados:", employees); // Para debug

        if (!employees || employees.length === 0) {
            // MOSTRA A ÁREA COM O BOTÃO SE NÃO VIER NADA
            noResultsArea.classList.remove('hidden');
            messageArea.innerText = "Nenhum resultado encontrado no TOTVS ou no MySQL.";
            messageArea.classList.remove('hidden');
        } else {
            // SE ENCONTRAR, MONTA A TABELA
            noResultsArea.classList.add('hidden');
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
                
                row.onclick = (e) => {
                    if(e.target.tagName !== 'BUTTON') openEpiModal(emp);
                };

                row.querySelector('.btn-report').onclick = (e) => {
                    e.stopPropagation();
                    openReportModal(emp);
                };

                tableBody.appendChild(row);
            });
        }
    } catch (error) {
        console.error("Erro na busca:", error);
        messageArea.innerText = "Erro na conexão com o servidor.";
        messageArea.classList.remove('hidden');
    } finally {
        loading.classList.add('hidden');
    }
}