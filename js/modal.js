const modal = document.getElementById('epiModal');
const closeBtn = document.querySelector('.close-button');

closeBtn.onclick = () => modal.classList.add('hidden');

async function openEpiModal(employee) {
    document.getElementById('modalEmployeeName').innerText = employee.nome;
    document.getElementById('modalEmployeeInfo').innerText = 
        `Matrícula: ${employee.matricula} | Cargo: ${employee.cargo}`;
    
    const epiListBody = document.getElementById('epiListBody');
    epiListBody.innerHTML = '<tr><td colspan="5">Carregando EPIs...</td></tr>';
    
    modal.classList.remove('hidden');

    try {
        const epis = await ApiService.getEmployeeEPIs(employee.matricula);
        epiListBody.innerHTML = '';

        epis.forEach(epi => {
            const row = document.createElement('tr');
            const statusClass = epi.entregue ? 'status-entregue' : 'status-pendente';
            
            row.innerHTML = `
                <td>${epi.nomeEPI}</td>
                <td class="${statusClass}">${epi.entregue ? 'Entregue' : 'Não entregue'}</td>
                <td>${epi.dataEntrega || '-'}</td>
                <td>${epi.validade || '-'}</td>
                <td>
                    <button onclick="handleDelivery('${employee.matricula}', '${epi.id}')">
                        Registrar Entrega
                    </button>
                </td>
            `;
            epiListBody.appendChild(row);
        });
    } catch (error) {
        epiListBody.innerHTML = '<tr><td colspan="5">Erro ao carregar EPIs.</td></tr>';
    }
}

async function handleDelivery(matricula, epiId) {
    if(confirm("Confirmar entrega de EPI?")) {
        try {
            await ApiService.registerDelivery(matricula, epiId);
            alert("Entrega registrada com sucesso!");
            // Recarrega o modal para atualizar status
            modal.classList.add('hidden');
            performSearch(); 
        } catch (error) {
            alert("Erro ao registrar entrega.");
        }
    }
}