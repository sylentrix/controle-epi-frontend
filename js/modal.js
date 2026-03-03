const epiModal = document.getElementById('epiModal');
const fichaModal = document.getElementById('fichaModal');
const reportModal = document.getElementById('reportModal');
const canvas = document.getElementById('sig-canvas');
const ctx = canvas.getContext('2d');

let currentEmployee = null;
let drawing = false;
let hasSignature = false; // Controle de obrigatoriedade da assinatura

// --- FECHAR MODAIS ---
document.getElementById('closeEpiModal').onclick = () => epiModal.classList.add('hidden');
document.getElementById('closeFichaModal').onclick = () => fichaModal.classList.add('hidden');
document.getElementById('closeReportModal').onclick = () => reportModal.classList.add('hidden');

// --- ABRIR MODAL DE HISTÓRICO ---
async function openEpiModal(employee) {
    currentEmployee = employee;
    document.getElementById('modalEmployeeName').innerText = employee.nome;
    document.getElementById('modalEmployeeInfo').innerText = `Matrícula: ${employee.matricula} | Setor: ${employee.setor}`;
    epiModal.classList.remove('hidden');
    loadEpiHistory(employee.matricula);
}

// --- ABRIR MODAL DE NOVA ENTREGA ---
document.getElementById('btnOpenFicha').onclick = () => {
    limparFormularioFicha(); // Garante que abre limpo
    fichaModal.classList.remove('hidden');
    document.getElementById('f_data').valueAsDate = new Date();
};

// --- MODAL DE RELATÓRIO (IMPRESSÃO) ---
async function openReportModal(employee) {
    // Preenche dados do cabeçalho do relatório
    document.getElementById('rep_matricula').innerText = employee.matricula;
    document.getElementById('rep_nome').innerText = employee.nome;
    document.getElementById('rep_cargo').innerText = employee.cargo;
    document.getElementById('rep_setor').innerText = employee.setor;
    document.getElementById('rep_turno').innerText = employee.turno;
    document.getElementById('rep_inicio').innerText = employee.dataInicio;
    document.getElementById('reportGenDate').innerText = new Date().toLocaleString('pt-BR');

    const body = document.getElementById('reportListBody');
    body.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
    reportModal.classList.remove('hidden');

    try {
        const epis = await ApiService.getEmployeeEPIs(employee.matricula);
        body.innerHTML = '';

        if (epis.length === 0) {
            body.innerHTML = '<tr><td colspan="6">Nenhum EPI registrado para este funcionário.</td></tr>';
            return;
        }

        epis.forEach(epi => {
            const row = document.createElement('tr');
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

// --- GERAR PDF / IMPRIMIR ---
document.getElementById('btnPrintReport').onclick = () => {
    const elemento = document.getElementById('printableArea');
    const nomeFuncionario = document.getElementById('rep_nome').innerText;
    
    const opt = {
        margin:       10,
        filename:     `Relatorio_EPI_${nomeFuncionario}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, logging: false, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(elemento).save();
};

// --- CARREGAR HISTÓRICO NO TABELA DO MODAL ---
async function loadEpiHistory(matricula) {
    const body = document.getElementById('epiListBody');
    body.innerHTML = '<tr><td colspan="8">Carregando...</td></tr>';
    try {
        const epis = await ApiService.getEmployeeEPIs(matricula);
        body.innerHTML = epis.length ? '' : '<tr><td colspan="8">Nenhum registro encontrado.</td></tr>';
        
        epis.forEach(epi => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${epi.epi}</td>
                <td>${epi.qtde}</td>
                <td>${epi.modelo || '-'}</td>
                <td>${epi.ca || '-'}</td>
                <td>${epi.dataRetirada}</td>
                <td>${epi.dataDevolucao || '-'}</td>
                <td>
                    ${epi.assinatura 
                        ? `<img src="${epi.assinatura}" alt="Assinatura" style="width: 100px; height: auto; border: 1px solid #eee;">` 
                        : 'Sem assinatura'}
                </td>
                <td>-</td>
            `;
            body.appendChild(row);
        });
    } catch (e) { 
        body.innerHTML = '<tr><td colspan="8">Erro ao carregar dados.</td></tr>'; 
    }
}

// --- LÓGICA DA ASSINATURA (CANVAS) ---
canvas.onmousedown = () => drawing = true;
canvas.onmouseup = () => { drawing = false; ctx.beginPath(); };
canvas.onmousemove = (e) => {
    if(!drawing) return;
    hasSignature = true; // Marca que o usuário assinou
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
};

document.getElementById('sig-clearBtn').onclick = (e) => {
    e.preventDefault();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    hasSignature = false; // Reseta a validação
};

// --- SALVAR FICHA COM VALIDAÇÃO ---
document.getElementById('btnSalvarFicha').onclick = async () => {
    const epi = document.getElementById('f_epi').value.trim();
    const dataRetirada = document.getElementById('f_data').value;
    const qtde = document.getElementById('f_qtde').value;
    const modelo = document.getElementById('f_modelo').value.trim();
    const ca = document.getElementById('f_ca').value.trim();

    // Validações de Campos Obrigatórios
    if (!epi) return alert("O campo 'E.P.I RECEBIDO' é obrigatório.");
    if (!dataRetirada) return alert("O campo 'DATA RETIRADA' é obrigatório.");
    if (!qtde || qtde <= 0) return alert("Informe uma 'QTDE' válida.");
    if (!modelo) return alert("O campo 'MODELO' é obrigatório.");
    if (!ca) return alert("O campo 'C.A.' é obrigatório.");

    // Validação da Assinatura
    if (!hasSignature) {
        return alert("A assinatura do funcionário é obrigatória.");
    }

    const payload = {
        funcionario: currentEmployee,
        ficha: {
            epi: epi,
            qtde: qtde,
            modelo: modelo,
            ca: ca,
            dataRetirada: dataRetirada,
            dataDevolucao: document.getElementById('f_devolucao').value,
            assinaturaBase64: canvas.toDataURL("image/png")
        }
    };

    try {
        await ApiService.saveFicha(payload);
        alert("✅ Registro salvo com sucesso!");
        
        limparFormularioFicha(); 
        fichaModal.classList.add('hidden');
        loadEpiHistory(currentEmployee.matricula);
    } catch (error) { 
        alert("Erro ao salvar: " + error.message); 
    }
};

// --- FUNÇÃO PARA LIMPAR FORMULÁRIO ---
function limparFormularioFicha() {
    document.getElementById('f_epi').value = '';
    document.getElementById('f_qtde').value = '1';
    document.getElementById('f_modelo').value = '';
    document.getElementById('f_ca').value = '';
    document.getElementById('f_devolucao').value = '';
    document.getElementById('f_data').valueAsDate = new Date();

    // Limpa Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    hasSignature = false; // Reseta o controle de obrigatoriedade
}