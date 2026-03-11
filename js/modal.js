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
// Chamado pelo botão do noResultsArea; recebe o termo buscado para pré-preencher a matrícula
function abrirModalCadastro(termoBuscado = '') {
    document.getElementById('formAddFuncionario').reset();
    document.getElementById('addFormError').classList.add('hidden');
    document.getElementById('addFormError').innerText = '';

    // Se o termo buscado for numérico, pré-preenche o campo de matrícula
    const campoMatricula = document.getElementById('add_matricula');
    campoMatricula.value = /^\d+$/.test(termoBuscado.trim()) ? termoBuscado.trim() : '';

    addEmployeeModal.classList.remove('hidden');
    // Foca no primeiro campo vazio
    const foco = campoMatricula.value ? document.getElementById('add_nome') : campoMatricula;
    setTimeout(() => foco.focus(), 100);
}

document.getElementById('btnOpenAddModal').onclick = () => {
    const termoBuscado = document.getElementById('searchInput')?.value || '';
    abrirModalCadastro(termoBuscado);
};

document.getElementById('btnCancelarAdd').onclick = () => {
    addEmployeeModal.classList.add('hidden');
};

// --- CADASTRO NOVO FUNCIONÁRIO ---
document.getElementById('formAddFuncionario').onsubmit = async (e) => {
    e.preventDefault();

    const errorBox = document.getElementById('addFormError');
    errorBox.classList.add('hidden');
    errorBox.innerText = '';

    const matricula = document.getElementById('add_matricula').value.trim();
    const nome      = document.getElementById('add_nome').value.trim();
    const cargo     = document.getElementById('add_cargo').value.trim();
    const setor     = document.getElementById('add_setor').value.trim();
    const turno     = document.getElementById('add_turno').value;
    const inicio    = document.getElementById('add_inicio').value;

    // Validação no front antes de bater no servidor
    const faltando = [];
    if (!matricula) faltando.push('Matrícula');
    if (!nome)      faltando.push('Nome Completo');
    if (!cargo)     faltando.push('Cargo');
    if (!setor)     faltando.push('Setor');
    if (!turno)     faltando.push('Turno');

    if (faltando.length > 0) {
        errorBox.innerText = `⚠️ Preencha os campos obrigatórios: ${faltando.join(', ')}.`;
        errorBox.classList.remove('hidden');
        return;
    }

    const btnSubmit = e.target.querySelector('[type="submit"]');
    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Salvando...';

    try {
        await ApiService.registerEmployee({ matricula, nome, cargo, setor, turno, inicio: inicio || null });
        addEmployeeModal.classList.add('hidden');
        document.getElementById('formAddFuncionario').reset();
        alert(`✅ Funcionário "${nome}" cadastrado com sucesso!`);
        // Repete a busca para mostrar o funcionário recém-cadastrado na tabela
        if (typeof performSearch === 'function') performSearch();
    } catch (error) {
        errorBox.innerText = `❌ ${error.message}`;
        errorBox.classList.remove('hidden');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = '✅ Confirmar Cadastro';
    }
};

// --- HISTÓRICO E ENTREGA EPI ---
async function openEpiModal(employee) {
    currentEmployee = employee;
    document.getElementById('modalEmployeeName').innerText = employee.nome;
    document.getElementById('modalEmployeeInfo').innerText = `Matrícula: ${employee.matricula} | Setor: ${employee.setor}`;

    // Verifica se já assinou o termo — se não, abre o termo antes do histórico
    try {
        const termo = await ApiService.getTermo(employee.matricula);
        if (!termo.assinou) {
            abrirTermoModal(employee);
            return; // não abre o epiModal ainda — o btnConfirmarTermo abrirá depois
        }
    } catch (e) {
        // erro de rede: deixa passar e abre o histórico normalmente
    }

    epiModal.classList.remove('hidden');
    loadEpiHistory(employee.matricula);
}




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

// ═══════════════════════════════════════════════════════════════
// MODAL 5: TERMO DE RESPONSABILIDADE
// Fluxo: abre EpiModal → verifica banco → se não assinou: abre termoModal
//         → assina → salva no banco → abre fichaModal (ou epiModal direto)
// ═══════════════════════════════════════════════════════════════
const termoModal      = document.getElementById('termoModal');
const termoSigCanvas  = document.getElementById('termo-sig-canvas');
const termoSigCtx     = termoSigCanvas.getContext('2d');
let termoDrawing      = false;
let termoHasSig       = false;

document.getElementById('closeTermoModal').onclick = () => termoModal.classList.add('hidden');
document.getElementById('btnCancelarTermo').onclick  = () => termoModal.classList.add('hidden');

// Canvas do termo — mouse
termoSigCanvas.onmousedown  = () => { termoDrawing = true; termoSigCtx.beginPath(); };
termoSigCanvas.onmouseup    = () => { termoDrawing = false; termoSigCtx.beginPath(); };
termoSigCanvas.onmouseleave = () => { termoDrawing = false; termoSigCtx.beginPath(); };
termoSigCanvas.onmousemove  = (e) => {
    if (!termoDrawing) return;
    termoHasSig = true;
    const r = termoSigCanvas.getBoundingClientRect();
    termoSigCtx.lineWidth = 2; termoSigCtx.lineCap = 'round'; termoSigCtx.lineJoin = 'round';
    termoSigCtx.lineTo(e.clientX - r.left, e.clientY - r.top);
    termoSigCtx.stroke();
    termoSigCtx.beginPath();
    termoSigCtx.moveTo(e.clientX - r.left, e.clientY - r.top);
};

// Canvas do termo — touch
termoSigCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); termoDrawing = true; termoSigCtx.beginPath();
}, { passive: false });
termoSigCanvas.addEventListener('touchend', (e) => {
    e.preventDefault(); termoDrawing = false; termoSigCtx.beginPath();
}, { passive: false });
termoSigCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!termoDrawing) return;
    termoHasSig = true;
    const r = termoSigCanvas.getBoundingClientRect();
    const t = e.touches[0];
    termoSigCtx.lineWidth = 2; termoSigCtx.lineCap = 'round'; termoSigCtx.lineJoin = 'round';
    termoSigCtx.lineTo(t.clientX - r.left, t.clientY - r.top);
    termoSigCtx.stroke();
    termoSigCtx.beginPath();
    termoSigCtx.moveTo(t.clientX - r.left, t.clientY - r.top);
}, { passive: false });

document.getElementById('termo-sig-clearBtn').onclick = (e) => {
    e.preventDefault();
    termoSigCtx.clearRect(0, 0, termoSigCanvas.width, termoSigCanvas.height);
    termoSigCtx.beginPath();
    termoHasSig = false;
};

// Preenche e abre o modal do termo
function abrirTermoModal(employee) {
    document.getElementById('termo_nome').innerText      = employee.nome;
    document.getElementById('termo_matricula').innerText = employee.matricula;
    document.getElementById('termo_cargo').innerText     = employee.cargo;
    document.getElementById('termo_setor').innerText     = employee.setor    || '-';
    document.getElementById('termo_turno').innerText     = employee.turno    || '-';
    document.getElementById('termo_inicio').innerText    = employee.dataInicio || '-';
    document.getElementById('termo_nome_sig').innerText  = employee.nome;
    document.getElementById('termo_data_sig').innerText  =
        new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });

    // Limpa canvas e erros
    termoSigCtx.clearRect(0, 0, termoSigCanvas.width, termoSigCanvas.height);
    termoSigCtx.beginPath();
    termoHasSig = false;
    document.getElementById('termoError').classList.add('hidden');
    document.getElementById('termoError').innerText = '';

    termoModal.classList.remove('hidden');

    // Rola para o topo do modal
    setTimeout(() => {
        termoModal.querySelector('.modal-content').scrollTop = 0;
    }, 50);
}

// Confirmar assinatura do termo
document.getElementById('btnConfirmarTermo').onclick = async () => {
    const errorBox = document.getElementById('termoError');
    errorBox.classList.add('hidden');

    if (!termoHasSig) {
        errorBox.innerText = '⚠️ Por favor, assine o termo antes de confirmar.';
        errorBox.classList.remove('hidden');
        return;
    }

    const btn = document.getElementById('btnConfirmarTermo');
    btn.disabled = true;
    btn.innerText = 'Salvando...';

    try {
        await ApiService.saveTermo(
            currentEmployee.matricula,
            currentEmployee,
            termoSigCanvas.toDataURL('image/png')
        );
        termoModal.classList.add('hidden');
        // Abre o histórico do funcionário (já assinou, fluxo normal)
        epiModal.classList.remove('hidden');
        loadEpiHistory(currentEmployee.matricula);
    } catch (e) {
        errorBox.innerText = `❌ Erro ao salvar assinatura: ${e.message}`;
        errorBox.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerText = '✅ Confirmar Leitura e Assinar';
    }
};

// ═══════════════════════════════════════════════════════════════
// BOTÃO "+ Registrar Nova Entrega" — verifica termo antes de abrir ficha
// ═══════════════════════════════════════════════════════════════
document.getElementById('btnOpenFicha').onclick = async () => {
    if (!currentEmployee) return;

    const btn = document.getElementById('btnOpenFicha');
    btn.disabled = true;
    btn.innerText = 'Verificando...';

    try {
        const termo = await ApiService.getTermo(currentEmployee.matricula);
        if (termo.assinou) {
            // Já assinou: vai direto para a ficha
            limparFormularioFicha();
            fichaModal.classList.remove('hidden');
        } else {
            // Ainda não assinou: abre o termo
            abrirTermoModal(currentEmployee);
        }
    } catch (e) {
        // Em caso de erro de rede, deixa passar para a ficha (não bloqueia)
        limparFormularioFicha();
        fichaModal.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerText = '+ Registrar Nova Entrega';
    }
};

// ═══════════════════════════════════════════════════════════════
// RELATÓRIO — canvas de assinatura inline (quando não há assinatura)
// ═══════════════════════════════════════════════════════════════
const repSigCanvas  = document.getElementById('rep-sig-canvas');
const repSigCtx     = repSigCanvas.getContext('2d');
let repDrawing      = false;
let repHasSig       = false;

// Mouse
repSigCanvas.onmousedown  = () => { repDrawing = true; repSigCtx.beginPath(); };
repSigCanvas.onmouseup    = () => { repDrawing = false; repSigCtx.beginPath(); };
repSigCanvas.onmouseleave = () => { repDrawing = false; repSigCtx.beginPath(); };
repSigCanvas.onmousemove  = (e) => {
    if (!repDrawing) return;
    repHasSig = true;
    const r = repSigCanvas.getBoundingClientRect();
    repSigCtx.lineWidth = 2; repSigCtx.lineCap = 'round'; repSigCtx.lineJoin = 'round';
    repSigCtx.lineTo(e.clientX - r.left, e.clientY - r.top);
    repSigCtx.stroke();
    repSigCtx.beginPath();
    repSigCtx.moveTo(e.clientX - r.left, e.clientY - r.top);
};
// Touch
repSigCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); repDrawing = true; repSigCtx.beginPath(); }, { passive: false });
repSigCanvas.addEventListener('touchend',   (e) => { e.preventDefault(); repDrawing = false; repSigCtx.beginPath(); }, { passive: false });
repSigCanvas.addEventListener('touchmove',  (e) => {
    e.preventDefault();
    if (!repDrawing) return;
    repHasSig = true;
    const r = repSigCanvas.getBoundingClientRect(), t = e.touches[0];
    repSigCtx.lineWidth = 2; repSigCtx.lineCap = 'round'; repSigCtx.lineJoin = 'round';
    repSigCtx.lineTo(t.clientX - r.left, t.clientY - r.top);
    repSigCtx.stroke();
    repSigCtx.beginPath();
    repSigCtx.moveTo(t.clientX - r.left, t.clientY - r.top);
}, { passive: false });

document.getElementById('rep-sig-clearBtn').onclick = (e) => {
    e.preventDefault();
    repSigCtx.clearRect(0, 0, repSigCanvas.width, repSigCanvas.height);
    repSigCtx.beginPath();
    repHasSig = false;
};

document.getElementById('rep-sig-saveBtn').onclick = async () => {
    if (!repHasSig) {
        alert('⚠️ Por favor, assine antes de salvar.');
        return;
    }
    const btn = document.getElementById('rep-sig-saveBtn');
    btn.disabled = true;
    btn.innerText = 'Salvando...';
    try {
        await ApiService.saveTermo(
            currentEmployee.matricula,
            currentEmployee,
            repSigCanvas.toDataURL('image/png')
        );
        // Troca o canvas pela imagem salva
        const pendente = document.getElementById('rep-sig-pendente');
        const sigImg   = document.getElementById('rep-sig-img');
        const sigDate  = document.getElementById('rep_dataAssinatura');
        pendente.style.display = 'none';
        sigImg.src           = repSigCanvas.toDataURL('image/png');
        sigImg.style.display = 'block';
        sigDate.innerText    = `Assinado em ${new Date().toLocaleDateString('pt-BR')}`;
    } catch (e) {
        alert('❌ Erro ao salvar: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = '💾 Salvar Assinatura';
    }
};

async function openReportModal(employee) {
    currentEmployee = employee; // garante que currentEmployee está sempre preenchido
    // Página 1 — dados do funcionário
    document.getElementById('rep_matricula').innerText  = employee.matricula;
    document.getElementById('rep_nome').innerText       = employee.nome;
    document.getElementById('rep_cargo').innerText      = employee.cargo;
    document.getElementById('rep_setor').innerText      = employee.setor    || '-';
    document.getElementById('rep_turno').innerText      = employee.turno    || '-';
    document.getElementById('rep_inicio').innerText     = employee.dataInicio || '-';
    document.getElementById('rep_nome_assinatura').innerText = employee.nome;

    // Página 2 — cabeçalho
    document.getElementById('rep2_nome').innerText      = employee.nome;
    document.getElementById('rep2_matricula').innerText = employee.matricula;
    document.getElementById('rep2_cargo').innerText     = employee.cargo;
    document.getElementById('rep2_setor').innerText     = employee.setor || '-';

    document.getElementById('rep_dataGeracao').innerText =
        new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric',
                                                  hour:'2-digit', minute:'2-digit' });

    // Reseta área de assinatura
    const sigImg     = document.getElementById('rep-sig-img');
    const sigPend    = document.getElementById('rep-sig-pendente');
    const sigDate    = document.getElementById('rep_dataAssinatura');
    sigImg.style.display  = 'none';
    sigPend.style.display = 'none';
    sigDate.innerText     = '';
    repSigCtx.clearRect(0, 0, repSigCanvas.width, repSigCanvas.height);
    repSigCtx.beginPath();
    repHasSig = false;

    reportModal.classList.remove('hidden');

    // Busca assinatura do banco
    try {
        const termo = await ApiService.getTermo(employee.matricula);
        if (termo.assinou && termo.assinatura) {
            sigImg.src           = termo.assinatura;
            sigImg.style.display = 'block';
            sigDate.innerText    = termo.dataAssinatura ? `Assinado em ${termo.dataAssinatura}` : '';
        } else {
            // Sem assinatura: mostra canvas para assinar agora
            sigPend.style.display = 'block';
        }
    } catch (e) {
        sigPend.style.display = 'block';
    }

    // Carrega tabela de entregas (página 2)
    const body = document.getElementById('reportListBody');
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:14px;">Carregando...</td></tr>';
    try {
        const epis = await ApiService.getEmployeeEPIs(employee.matricula);
        body.innerHTML = epis.length
            ? ''
            : '<tr><td colspan="7" style="text-align:center;padding:14px;color:#888;">Nenhum registro de entrega encontrado.</td></tr>';
        epis.forEach(epi => {
            const row = document.createElement('tr');
            const assinaturaHtml = epi.assinatura
                ? `<img src="${epi.assinatura}" style="max-height:52px;max-width:160px;width:auto;height:auto;object-fit:contain;">`
                : '<span style="color:#aaa;">—</span>';
            row.innerHTML = `
                <td>${epi.epi}</td>
                <td style="text-align:center;">${epi.qtde}</td>
                <td>${epi.modelo || '-'}</td>
                <td style="text-align:center;">${epi.ca || '-'}</td>
                <td style="text-align:center;">${epi.dataRetirada}</td>
                <td style="text-align:center;">${epi.dataDevolucao || '-'}</td>
                <td style="text-align:center;">${assinaturaHtml}</td>
            `;
            body.appendChild(row);
        });
    } catch (e) {
        body.innerHTML = '<tr><td colspan="7">Erro ao carregar dados.</td></tr>';
    }
}

// ─── IMPRIMIR — iframe invisível + HTML 100% autossuficiente ─────────────────
document.getElementById('btnPrintReport').onclick = function () {

    // 1. Lê dados já preenchidos no DOM
    function g(id) { var el = document.getElementById(id); return el ? (el.innerText || '').trim() : ''; }

    var nome      = g('rep_nome');
    var matricula = g('rep_matricula');
    var cargo     = g('rep_cargo');
    var inicio    = g('rep_inicio');
    var setor     = g('rep_setor');
    var turno     = g('rep_turno');
    var nomeSig   = g('rep_nome_assinatura');
    var dataSig   = g('rep_dataAssinatura');
    var dataGer   = g('rep_dataGeracao');

    // 2. Assinatura (imagem base64 já carregada)
    var sigImgEl = document.getElementById('rep-sig-img');
    var sigSrc   = (sigImgEl && sigImgEl.style.display !== 'none' && sigImgEl.src) ? sigImgEl.src : '';
    var assinHtml = sigSrc
        ? '<img src="' + sigSrc + '" alt="Assinatura">'
        : '<div style="height:70px;width:280px;"></div>';

    // 3. Linhas da tabela de entregas lidas do DOM
    var tbody = document.getElementById('reportListBody');
    var linhas = '';
    if (tbody) {
        var trs = tbody.querySelectorAll('tr');
        for (var i = 0; i < trs.length; i++) {
            var tds = trs[i].querySelectorAll('td');
            if (!tds.length) continue;
            var fundo = (i % 2 === 1) ? '#f5f5f5' : '#fff';
            var cells = '';
            for (var j = 0; j < tds.length; j++) {
                var al = (j >= 1) ? 'center' : 'left';
                var imgEl = tds[j].querySelector('img');
                var val = imgEl
                    ? '<img src="' + imgEl.src + '" style="max-height:52px;max-width:140px;width:auto;height:auto;display:block;margin:0 auto;object-fit:contain;">'
                    : (tds[j].innerText || '').trim();
                cells += '<td style="padding:5px 7px;border:1px solid #ccc;font-size:10.5px;text-align:' + al + ';background:' + fundo + ';">' + val + '</td>';
            }
            linhas += '<tr>' + cells + '</tr>';
        }
    }
    if (!linhas) linhas = '<tr><td colspan="7" style="padding:14px;text-align:center;color:#888;border:1px solid #ccc;font-size:11px;">Nenhum registro de entrega encontrado.</td></tr>';

    // 4. CSS completamente inline, sem dependência externa
    var css = '' +
        '* { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }' +
        'body { font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#000; background:#fff; }' +
        '@page { size:A4 portrait; margin:0; }' +
        '@page landscape { size:A4 landscape; margin:0; }' +
        '.p1 { width:210mm; padding:12mm 15mm 10mm; page-break-after:always; break-after:page; background:#fff; display:flex; flex-direction:column; }' +
        '.p2 { width:297mm; min-height:210mm; padding:12mm 16mm 10mm; background:#fff; page:landscape; }' +
        'h2 { font-size:13px; font-weight:700; text-transform:uppercase; text-align:center; letter-spacing:.4px; }' +
        '.sub { font-size:10px; color:#444; text-align:center; margin-top:2px; line-height:1.35; }' +
        '.hdr { border-bottom:2px solid #222; padding-bottom:6px; margin-bottom:8px; }' +
        '.stitle { background:#2c3e50; color:#fff; font-size:9.5px; font-weight:700; text-transform:uppercase; padding:3px 8px; margin:7px 0 5px; letter-spacing:.5px; }' +
        '.row { display:flex; gap:6px; margin-bottom:4px; }' +
        '.fld { border:1px solid #bbb; border-radius:3px; padding:3px 7px; flex:1; min-width:0; }' +
        '.fld.xl { flex:3; }' +
        '.fl { font-size:8px; font-weight:700; text-transform:uppercase; color:#666; display:block; }' +
        '.fv { font-size:11px; font-weight:600; display:block; margin-top:1px; word-break:break-word; }' +
        '.tbody { margin-top:6px; font-size:9.5px; line-height:1.4; }' +
        '.tbody > p { margin-bottom:4px; text-align:justify; }' +
        '.tlist { padding-left:14px; margin-top:3px; }' +
        '.tlist li { margin-bottom:2px; text-align:justify; font-size:9px; line-height:1.35; }' +
        '.sarea { margin-top:8px; padding:8px 10px; border-top:2px solid #2c3e50; border-radius:3px; background:#fafafa; page-break-inside:avoid; break-inside:avoid; }' +
        '.slbl { font-size:9.5px; font-weight:700; color:#333; margin-bottom:6px; }' +
        '.sig-img-wrap { height:85px; display:flex; align-items:center; margin-bottom:4px; }' +
        '.sig-img-wrap img { max-height:80px; max-width:280px; width:auto; height:auto; object-fit:contain; display:block; }' +
        '.sig-line { border-top:1.5px solid #333; width:280px; margin-bottom:3px; }' +
        '.sname { font-size:10.5px; font-weight:600; }' +
        '.sdate { font-size:9.5px; color:#555; margin-top:1px; }' +
        'table { width:100%; border-collapse:collapse; margin-top:8px; }' +
        'thead th { background:#2c3e50; color:#fff; font-size:11px; padding:7px 8px; border:1px solid #2c3e50; text-align:center; }' +
        'thead th:first-child { text-align:left; }' +
        'tbody td { vertical-align:middle; min-height:58px; }' +
        '.foot { margin-top:12px; font-size:10px; color:#777; text-align:right; }';

    // 5. Monta HTML completo
    var html =
        '<!DOCTYPE html><html lang="pt-br"><head><meta charset="UTF-8">' +
        '<title>EPI - ' + nome + '</title>' +
        '<style>' + css + '</style></head><body>' +

        // ── PÁGINA 1
        '<div class="p1">' +
        '<div class="hdr"><h2>FICHA DE ENTREGA DOS EPI\'S</h2>' +
        '<p class="sub">TERMO DE RESPONSABILIDADE PELA GUARDA E USO DE<br>EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL — E.P.I.</p></div>' +
        '<div class="stitle">IDENTIFICAÇÃO DO EMPREGADO</div>' +
        '<div class="row">' +
            '<div class="fld xl"><span class="fl">Nome</span><span class="fv">' + nome + '</span></div>' +
            '<div class="fld"><span class="fl">Matrícula</span><span class="fv">' + matricula + '</span></div>' +
        '</div>' +
        '<div class="row">' +
            '<div class="fld xl"><span class="fl">Cargo</span><span class="fv">' + cargo + '</span></div>' +
            '<div class="fld"><span class="fl">Início</span><span class="fv">' + inicio + '</span></div>' +
        '</div>' +
        '<div class="row">' +
            '<div class="fld xl"><span class="fl">Setor</span><span class="fv">' + setor + '</span></div>' +
            '<div class="fld"><span class="fl">Turno</span><span class="fv">' + turno + '</span></div>' +
        '</div>' +
        '<div class="tbody">' +
        '<p>Recebi da empresa <strong>Brico Bread Alimentos Ltda.</strong>, a título de empréstimo, para meu uso exclusivo e obrigatório nas dependências da empresa, conforme determinado na NR-6 da Portaria MTP nº 4.219, de 20 de novembro de 2022, os equipamentos especificados neste termo de responsabilidade, comprometendo-me a mantê-los em perfeito estado de conservação, ficando ciente de que:</p>' +
        '<ol class="tlist">' +
        '<li>Recebi treinamento quanto à necessidade na utilização dos referidos EPI\'s, a maneira correta de usá-los, guardá-los e higienizá-los, bem como da minha responsabilidade quanto a seu uso conforme determinado na NR-1 da Portaria MTP nº 4.219, de 20 de dezembro de 2022.</li>' +
        '<li>Se o equipamento for danificado ou inutilizado por emprego inadequado, mau uso, negligência ou extravio, a empresa me fornecerá novo equipamento e cobrará o valor de um equipamento da mesma marca ou equivalente ao da praça (parágrafo único do artigo 462 da CLT).</li>' +
        '<li>Fico proibido de dar ou emprestar o equipamento que estiver sob minha responsabilidade, só podendo fazê-lo se receber ordem por escrito da pessoa autorizada para tal fim.</li>' +
        '<li>Em caso de dano, inutilização ou extravio do equipamento deverei comunicar imediatamente ao setor competente.</li>' +
        '<li>Terminando os serviços ou no caso de rescisão do contrato de trabalho, devolverei o equipamento completo e em perfeito estado de conservação, considerando-se o tempo do uso dele, ao setor competente.</li>' +
        '<li>Fico ciente de que não utilizando o equipamento de proteção individual em serviço estarei sujeito às sanções disciplinares cabíveis que irão desde simples advertências até a dispensa por justa causa nos termos do Art. 482 da C.L.T. combinado com a NR-1 e NR-6 da Portaria 3.214/78.</li>' +
        '<li>Recebi um armário com cadeado, em perfeitas condições, para minha utilização. Sou responsável pela cópia da chave que me foi entregue e que, em caso de sua perda ou extravio, terei que repor uma nova cópia.</li>' +
        '<li>Estando os equipamentos em minha posse, estarei sujeito a inspeções sem prévio aviso.</li>' +
        '<li>Fico ciente de que não utilizando o equipamento de proteção individual em serviço estarei sujeito às sanções disciplinares cabíveis que irão desde simples advertências até a dispensa por justa causa nos termos do Art. 482 da C.L.T. combinado com a NR-1 e NR-6 da Portaria 3.214/78.</li>' +
        '</ol></div>' +
        '<div class="sarea"><p class="slbl">Ciente e de acordo com os termos acima:</p>' +
        '<div class="sig-img-wrap">' + assinHtml + '</div>' +
        '<div class="sig-line"></div>' +
        '<div class="sname">' + nomeSig + '</div>' +
        '<div class="sdate">' + dataSig + '</div></div>' +
        '</div>' +

        // ── PÁGINA 2
        '<div class="p2">' +
        '<div class="hdr"><h2>HISTÓRICO DE ENTREGAS DE EPI</h2>' +
        '<p class="sub"><strong>' + nome + '</strong> &nbsp;|&nbsp; Matrícula: <strong>' + matricula + '</strong> &nbsp;|&nbsp; Cargo: <strong>' + cargo + '</strong> &nbsp;|&nbsp; Setor: <strong>' + setor + '</strong></p></div>' +
        '<table><thead><tr>' +
        '<th style="text-align:left;width:22%;">EPI</th>' +
        '<th style="width:5%;">Qtde</th>' +
        '<th style="text-align:left;width:18%;">Modelo</th>' +
        '<th style="width:7%;">C.A.</th>' +
        '<th style="width:10%;">Retirada</th>' +
        '<th style="width:10%;">Devolução</th>' +
        '<th style="width:25%;text-align:center;">Assinatura</th>' +
        '</tr></thead><tbody>' + linhas + '</tbody></table>' +
        '<div class="foot">Documento gerado em: ' + dataGer + '</div>' +
        '</div>' +

        '</body></html>';

    // 6. Injeta em iframe invisível (evita popup bloqueado) e chama print()
    var old = document.getElementById('_epiPrintFrame');
    if (old) old.remove();

    var iframe = document.createElement('iframe');
    iframe.id = '_epiPrintFrame';
    // Visível mas fora da tela — necessário para alguns browsers renderizarem antes do print
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:none;z-index:-9999;';
    document.body.appendChild(iframe);

    var iDoc = iframe.contentDocument || iframe.contentWindow.document;
    iDoc.open();
    iDoc.write(html);
    iDoc.close();

    iframe.onload = function () {
        setTimeout(function () {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (e) {
                alert('Erro ao imprimir: ' + e.message);
            }
            setTimeout(function () {
                var f = document.getElementById('_epiPrintFrame');
                if (f) f.remove();
            }, 5000);
        }, 700);
    };
};

// ─── SALVAR PDF (página 1 retrato + página 2 paisagem mescladas) ─
document.getElementById('btnSavePDF').onclick = async () => {
    const btn = document.getElementById('btnSavePDF');
    btn.disabled = true;
    btn.innerText = '⏳ Gerando PDF...';

    try {
        const page1 = document.querySelector('.report-page-portrait');
        const page2 = document.querySelector('.report-page-landscape');

        const optsPortrait = {
            margin: [12, 15, 12, 15],
            image:  { type: 'jpeg', quality: 0.97 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        const optsLandscape = {
            margin: [12, 15, 12, 15],
            image:  { type: 'jpeg', quality: 0.97 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };

        // Gera os dois PDFs como ArrayBuffer
        const [bytes1, bytes2] = await Promise.all([
            html2pdf().set(optsPortrait).from(page1).outputPdf('arraybuffer'),
            html2pdf().set(optsLandscape).from(page2).outputPdf('arraybuffer')
        ]);

        // Mescla com pdf-lib
        const { PDFDocument } = PDFLib;
        const merged   = await PDFDocument.create();
        const doc1     = await PDFDocument.load(bytes1);
        const doc2     = await PDFDocument.load(bytes2);
        const [p1]     = await merged.copyPages(doc1, [0]);
        const pages2   = await merged.copyPages(doc2, doc2.getPageIndices());

        merged.addPage(p1);
        pages2.forEach(p => merged.addPage(p));

        const finalBytes = await merged.save();
        const blob = new Blob([finalBytes], { type: 'application/pdf' });
        const url  = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href     = url;
        a.download = `EPI_${document.getElementById('rep_nome').innerText.replace(/\s+/g,'_')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        alert('❌ Erro ao gerar PDF: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = '💾 Salvar PDF';
    }
};



