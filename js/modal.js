const epiModal = document.getElementById('epiModal');
const fichaModal = document.getElementById('fichaModal');
const canvas = document.getElementById('sig-canvas');
const ctx = canvas.getContext('2d');
let currentEmployee = null; 
let drawing = false;
const reportModal = document.getElementById('reportModal');
document.getElementById('closeReportModal').onclick = () => reportModal.classList.add('hidden');

// --- CONTROLE DOS MODAIS ---
async function openEpiModal(employee) {
    currentEmployee = employee;
    document.getElementById('modalEmployeeName').innerText = employee.nome;
    document.getElementById('modalEmployeeInfo').innerText = `Matrícula: ${employee.matricula} | Setor: ${employee.setor}`;
    epiModal.classList.remove('hidden');
    loadEpiHistory(employee.matricula);
}

async function openReportModal(employee) {
    // ... (mantenha o código de preencher dados do funcionário igual)

    try {
        const epis = await ApiService.getEmployeeEPIs(employee.matricula);
        body.innerHTML = '';
        
        epis.forEach(epi => {
            const row = document.createElement('tr');
            
            // VERIFICAÇÃO DA ASSINATURA:
            // Se epi.assinatura existir, cria a tag <img>. Se não, escreve "Sem assinatura".
            const assinaturaHtml = epi.assinatura 
                ? `<img src="${epi.assinatura}" style="height: 40px; display: block;">` 
                : '<span style="color: #999; font-size: 0.7rem;">Sem assinatura</span>';

            row.innerHTML = `
                <td>${epi.epi}</td>
                <td>${epi.qtde}</td>
                <td>${epi.ca || '-'}</td>
                <td>${epi.dataRetirada}</td>
                <td>${epi.dataDevolucao || '-'}</td>
                <td>${assinaturaHtml}</td>
            `;
            body.appendChild(row);
        });
    } catch (e) {
        body.innerHTML = '<tr><td colspan="6">Erro ao carregar dados.</td></tr>';
    }
}

// Função de Imprimir
// Função para Gerar PDF Real
document.getElementById('btnPrintReport').onclick = () => {
    const elemento = document.getElementById('printableArea');
    const nomeFuncionario = document.getElementById('rep_nome').innerText;
    
    // Configurações do PDF
    const opt = {
        margin:       10,
        filename:     `Relatorio_EPI_${nomeFuncionario}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, logging: false, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] } // Evita quebrar assinaturas no meio
    };

    // Gerar e baixar
    html2pdf().set(opt).from(elemento).save();
};

document.getElementById('closeEpiModal').onclick = () => epiModal.classList.add('hidden');
document.getElementById('closeFichaModal').onclick = () => fichaModal.classList.add('hidden');
document.getElementById('btnOpenFicha').onclick = () => {
    fichaModal.classList.remove('hidden');
    document.getElementById('f_data').valueAsDate = new Date();
};

// --- HISTÓRICO ---
async function loadEpiHistory(matricula) {
    const body = document.getElementById('epiListBody');
    body.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
    try {
        const epis = await ApiService.getEmployeeEPIs(matricula);
        body.innerHTML = epis.length ? '' : '<tr><td colspan="7">Nenhum registro encontrado.</td></tr>';
        
        epis.forEach(epi => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${epi.epi}</td>
                <td>${epi.qtde}</td>
                <td>${epi.modelo || '-'}</td>
                <td>${epi.ca || '-'}</td>
                <td>${epi.dataRetirada}</td>
                <td>${epi.dataDevolucao}</td>
                <td>
                    ${epi.assinatura 
                        ? `<img src="${epi.assinatura}" alt="Assinatura" style="width: 100px; height: auto; border: 1px solid #eee;">` 
                        : 'Sem assinatura'}
                </td>
            `;
            body.appendChild(row);
        });
    } catch (e) { 
        body.innerHTML = '<tr><td colspan="7">Erro ao carregar dados.</td></tr>'; 
    }
}

// --- ASSINATURA ---
canvas.onmousedown = () => drawing = true;
canvas.onmouseup = () => { drawing = false; ctx.beginPath(); };
canvas.onmousemove = (e) => {
    if(!drawing) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
};
document.getElementById('sig-clearBtn').onclick = (e) => {
    e.preventDefault();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
};

// --- SALVAR ---
document.getElementById('btnSalvarFicha').onclick = async () => {
    const epiNome = document.getElementById('f_epi').value;
    if(!epiNome) return alert("Informe o EPI.");

    const payload = {
        funcionario: currentEmployee,
        ficha: {
            epi: epiNome,
            qtde: document.getElementById('f_qtde').value,
            modelo: document.getElementById('f_modelo').value,
            ca: document.getElementById('f_ca').value,
            dataRetirada: document.getElementById('f_data').value,
            dataDevolucao: document.getElementById('f_devolucao').value,
            assinaturaBase64: canvas.toDataURL("image/png")
        }
    };

    try {
        await ApiService.saveFicha(payload);
        alert("✅ Salvo no MySQL!");
        fichaModal.classList.add('hidden');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        loadEpiHistory(currentEmployee.matricula);
    } catch (error) { alert("Erro: " + error.message); }
};