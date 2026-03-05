document.getElementById('btnSearch').addEventListener('click', performSearch);

document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

async function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    const loading       = document.getElementById('loading');
    const tableBody     = document.getElementById('employeeBody');
    const messageArea   = document.getElementById('messageArea');
    const noResultsArea = document.getElementById('noResultsArea');

    if (!query) return alert("Digite um nome ou matrícula para pesquisar.");

    // Reset de tela
    loading.classList.remove('hidden');
    tableBody.innerHTML = '';
    messageArea.classList.add('hidden');
    messageArea.className = 'hidden';
    noResultsArea.classList.add('hidden');

    try {
        const data = await ApiService.searchEmployees(query);

        // Suporte ao formato antigo (array) e novo ({ resultados, fontes })
        const employees = Array.isArray(data) ? data : (data.resultados || []);
        const fontes    = Array.isArray(data) ? null  : (data.fontes    || null);

        // ── Aviso de fonte indisponível ────────────────────────────────
        if (fontes) {
            const avisos = [];
            if (!fontes.mysql.ok) avisos.push("⚠️ Banco interno (MySQL) indisponível.");
            if (!fontes.odbc.ok)  avisos.push("⚠️ TOTVS (ODBC) indisponível.");

            if (avisos.length > 0) {
                messageArea.innerText = avisos.join("  ");
                messageArea.classList.remove('hidden');
                messageArea.classList.add('msg-warning');
            }
        }

        // ── Sem resultados em nenhuma fonte ────────────────────────────
        if (!employees || employees.length === 0) {
            noResultsArea.classList.remove('hidden');

            // Só exibe "não encontrado" se as duas fontes responderam OK
            const ambosOk = !fontes || (fontes.mysql.ok && fontes.odbc.ok);
            if (ambosOk) {
                const notFound = document.createElement('p');
                notFound.innerText = `Nenhum resultado encontrado para "${query}".`;
                // Evita duplicar a mensagem caso já exista aviso de fonte
                if (messageArea.classList.contains('hidden')) {
                    messageArea.innerText = notFound.innerText;
                    messageArea.classList.remove('hidden');
                }
            }
            return;
        }

        // ── Monta tabela de resultados ─────────────────────────────────
        employees.forEach(emp => {
            const row = document.createElement('tr');

            // Badge de origem (TOTVS ou interno)
            const origemBadge = emp.origem === 'TOTVS'
                ? '<span class="badge badge-totvs">TOTVS</span>'
                : '<span class="badge badge-mysql">Interno</span>';

            row.innerHTML = `
                <td>${emp.matricula}</td>
                <td>${emp.nome} ${origemBadge}</td>
                <td>${emp.cargo}</td>
                <td>${emp.setor}</td>
                <td>${emp.turno}</td>
                <td>${emp.dataInicio || '-'}</td>
                <td><button class="btn-report" title="Gerar Relatório">📄</button></td>
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
        messageArea.innerText = "❌ Erro na conexão com o servidor. Verifique se ele está rodando.";
        messageArea.classList.remove('hidden');
        messageArea.classList.add('msg-error');

        // Mesmo com erro de servidor, exibe botão de inserir
        noResultsArea.classList.remove('hidden');
    } finally {
        loading.classList.add('hidden');
    }
}
