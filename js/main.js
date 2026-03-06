document.getElementById('btnSearch').addEventListener('click', performSearch);

document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

async function performSearch() {
    const query        = document.getElementById('searchInput').value.trim();
    const loading      = document.getElementById('loading');
    const tableBody    = document.getElementById('employeeBody');
    const messageArea  = document.getElementById('messageArea');
    const noResultsArea = document.getElementById('noResultsArea');

    if (!query) return alert("Digite um nome ou matr\u00edcula para pesquisar.");

    // Reset de tela
    loading.classList.remove('hidden');
    tableBody.innerHTML = '';
    messageArea.className = 'hidden';
    messageArea.innerText = '';
    noResultsArea.classList.add('hidden');

    // Sempre configura o botão de adicionar com o termo atual
    document.getElementById('btnOpenAddModal').onclick = () => {
        if (typeof abrirModalCadastro === 'function') abrirModalCadastro(query);
    };

    try {
        const data = await ApiService.searchEmployees(query);

        const employees = Array.isArray(data) ? data : (data.resultados || []);
        const fontes    = Array.isArray(data) ? null  : (data.fontes    || null);

        // ── Informa qual fonte foi usada / avisos de indisponibilidade ───────────
        if (fontes) {
            const avisos = [];

            // TOTVS indispon\u00edvel (mas MySQL foi consultado)
            if (fontes.odbc.consultado && !fontes.odbc.ok) {
                avisos.push("\u26a0\ufe0f TOTVS indispon\u00edvel \u2014 resultado do banco interno.");
            }

            // MySQL tamb\u00e9m falhou
            if (fontes.mysql.consultado && !fontes.mysql.ok) {
                avisos.push("\u26a0\ufe0f Banco interno (MySQL) tamb\u00e9m indispon\u00edvel.");
            }

            if (avisos.length > 0) {
                messageArea.innerText = avisos.join("  ");
                messageArea.classList.remove('hidden');
                messageArea.classList.add('msg-warning');
            }
        }

        // ── Sem resultados em nenhuma fonte ────────────────────────────────
        if (!employees || employees.length === 0) {
            document.getElementById('noResultsMsg').innerText = 'Funcionário não encontrado em nenhuma base.';
            noResultsArea.classList.remove('hidden');

            // S\u00f3 mostra mensagem de "n\u00e3o encontrado" se n\u00e3o h\u00e1 aviso de indisponibilidade j\u00e1 exibido
            if (messageArea.classList.contains('hidden')) {
                messageArea.innerText = `Nenhum resultado encontrado para "${query}" em nenhuma base.`;
                messageArea.classList.remove('hidden');
            }
            return;
        }

        // ── Monta tabela de resultados ────────────────────────────────────
        // Exibe botão de adicionar mesmo quando há resultados
        document.getElementById('noResultsMsg').innerText = 'Não é o funcionário que procurava? Cadastre um novo.';
        noResultsArea.classList.remove('hidden');
        employees.forEach(emp => {
            const row = document.createElement('tr');

            const origemLabel = emp.origem === 'TOTVS' ? 'TOTVS' : 'Interno';
            const origemClass = emp.origem === 'TOTVS' ? 'badge-totvs' : 'badge-mysql';
            const origemBadge = `<span class="badge ${origemClass}">${origemLabel}</span>`;

            row.innerHTML = `
                <td>${emp.matricula}</td>
                <td>${emp.nome} ${origemBadge}</td>
                <td>${emp.cargo}</td>
                <td>${emp.setor}</td>
                <td>${emp.turno}</td>
                <td>${emp.dataInicio || '-'}</td>
                <td><button class="btn-report" title="Gerar Relat\u00f3rio">\ud83d\udcc4</button></td>
            `;

            row.onclick = (e) => {
                if (e.target.tagName !== 'BUTTON') openEpiModal(emp);
            };

            row.querySelector('.btn-report').onclick = (e) => {
                e.stopPropagation();
                openReportModal(emp);
            };

            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error("Erro na busca:", error);
        messageArea.innerText = "\u274c Erro na conex\u00e3o com o servidor. Verifique se ele est\u00e1 rodando.";
        messageArea.classList.remove('hidden');
        messageArea.classList.add('msg-error');
        // Mesmo com erro de servidor, exibe botão de inserir
        noResultsArea.classList.remove('hidden');
    } finally {
        loading.classList.add('hidden');
    }
}
