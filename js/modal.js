const epiModal = document.getElementById('epiModal');
const fichaModal = document.getElementById('fichaModal');
const reportModal = document.getElementById('reportModal');
const addEmployeeModal = document.getElementById('addEmployeeModal');

const canvas = document.getElementById('sig-canvas');
const ctx = canvas.getContext('2d');

let currentEmployee = null;
let drawing = false;
let hasSignature = false;

// --- FECHAR MODAIS ---
document.getElementById('closeEpiModal').onclick = () => epiModal.classList.add('hidden');
document.getElementById('closeFichaModal').onclick = () => fichaModal.classList.add('hidden');
document.getElementById('closeReportModal').onclick = () => reportModal.classList.add('hidden');
document.getElementById('closeAddModal').onclick = () => addEmployeeModal.classList.add('hidden');

// --- ABRIR MODAL CADASTRO ---
document.getElementById('btnOpenAddModal').onclick = () => {
    document.getElementById('add_criado_em').value = new Date().toLocaleDateString('pt-BR');
    addEmployeeModal.classList.remove('hidden');
};

// --- CADASTRO NOVO FUNCIONÁRIO ---
document.getElementById('formAddFuncionario').onsubmit = async (e) => {
    e.preventDefault();

    const data = {
        matricula: document.getElementById('add_matricula').value,
        nome: document.getElementById('add_nome').value.trim(),
        cargo: document.getElementById('add_cargo').value.trim(),
        setor: document.getElementById('add_setor').value.trim(),
        turno: document.getElementById('add_turno').value,
        inicio: document.getElementById('add_inicio').value
    };

    try {
        await ApiService.registerEmployee(data);
        alert("✅ Funcionário cadastrado com sucesso!");
        addEmployeeModal.classList.add('hidden');
        document.getElementById('formAddFuncionario').reset();
        if (typeof performSearch === "function") performSearch();
    } catch (error) {
        alert("❌ Erro ao cadastrar: " + error.message);
    }
};

// --- HISTÓRICO E ENTREGA EPI ---
async function openEpiModal(employee) {
    currentEmployee = employee;
    document.getElementById('modalEmployeeName').innerText = employee.nome;
    document.getElementById('modalEmployeeInfo').innerText = `Matrícula: ${employee.matricula} | Setor: ${employee.setor}`;
    epiModal.classList.remove('hidden');
    loadEpiHistory(employee.matricula);
}

document.getElementById('btnOpenFicha').onclick = () => {
    limparFormularioFicha();
    fichaModal.classList.remove('hidden');
};

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
                <td><img src="${epi.assinatura}" style="width: 80px;"></td>
                <td>-</td>
            `;
            body.appendChild(row);
        });
    } catch (e) { body.innerHTML = '<tr><td colspan="8">Erro ao carregar dados.</td></tr>'; }
}

// --- ASSINATURA (Mouse) ---
canvas.onmousedown = (e) => { drawing = true; ctx.beginPath(); };
canvas.onmouseup = () => { drawing = false; ctx.beginPath(); };
canvas.onmouseleave = () => { drawing = false; ctx.beginPath(); };
canvas.onmousemove = (e) => {
    if (!drawing) return;
    hasSignature = true;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
};

// --- ASSINATURA (Touch/Mobile) ---
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    drawing = true;
    ctx.beginPath();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    drawing = false;
    ctx.beginPath();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!drawing) return;
    hasSignature = true;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
}, { passive: false });

document.getElementById('sig-clearBtn').onclick = (e) => {
    e.preventDefault();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    hasSignature = false;
};

// --- VALIDAÇÃO E SALVAMENTO DA FICHA ---
document.getElementById('btnSalvarFicha').onclick = async () => {
    const epi        = document.getElementById('f_epi').value.trim();
    const qtde       = document.getElementById('f_qtde').value.trim();
    const modelo     = document.getElementById('f_modelo').value.trim();
    const ca         = document.getElementById('f_ca').value.trim();
    const dataRetirada = document.getElementById('f_data').value.trim();

    // --- Campos obrigatórios ---
    const camposFaltando = [];
    if (!epi)          camposFaltando.push('E.P.I Recebido');
    if (!qtde || Number(qtde) < 1) camposFaltando.push('Quantidade');
    if (!modelo)       camposFaltando.push('Modelo');
    if (!ca)           camposFaltando.push('C.A.');
    if (!dataRetirada) camposFaltando.push('Data de Retirada');
    if (!hasSignature) camposFaltando.push('Assinatura do Funcionário');

    if (camposFaltando.length > 0) {
        alert(`❌ Preencha os campos obrigatórios:\n\n• ${camposFaltando.join('\n• ')}`);
        return;
    }

    const payload = {
        funcionario: currentEmployee,
        ficha: {
            epi,
            qtde,
            modelo,
            ca,
            dataRetirada,
            assinaturaBase64: canvas.toDataURL("image/png")
        }
    };

    try {
        await ApiService.saveFicha(payload);
        alert("✅ Registro salvo com sucesso!");
        fichaModal.classList.add('hidden');
        limparFormularioFicha();
        loadEpiHistory(currentEmployee.matricula);
    } catch (e) {
        alert("❌ Erro ao salvar: " + e.message);
    }
};

// --- LIMPAR FORMULÁRIO COMPLETO ---
function limparFormularioFicha() {
    document.getElementById('f_epi').value = '';
    document.getElementById('f_qtde').value = '1';
    document.getElementById('f_modelo').value = '';
    document.getElementById('f_ca').value = '';
    document.getElementById('f_data').valueAsDate = new Date();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    hasSignature = false;
}

// --- RELATÓRIO ---
async function openReportModal(employee) {
    document.getElementById('rep_matricula').innerText = employee.matricula;
    document.getElementById('rep_nome').innerText = employee.nome;
    document.getElementById('rep_cargo').innerText = employee.cargo;
    reportModal.classList.remove('hidden');
    const body = document.getElementById('reportListBody');
    body.innerHTML = '';
    try {
        const epis = await ApiService.getEmployeeEPIs(employee.matricula);
        epis.forEach(epi => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${epi.epi}</td><td>${epi.qtde}</td><td>${epi.ca}</td><td>${epi.dataRetirada}</td><td><img src="${epi.assinatura}" height="40"></td>`;
            body.appendChild(row);
        });
    } catch (e) {}
}

document.getElementById('btnPrintReport').onclick = () => {
    const elemento = document.getElementById('printableArea');
    html2pdf().set({ margin: 10, filename: 'Relatorio.pdf', jsPDF: { format: 'a4' } }).from(elemento).save();
};