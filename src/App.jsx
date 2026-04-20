import React, { useState, useEffect, useRef } from 'react';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc 
} from 'firebase/firestore';
import { 
  Car, Bike, Search, Plus, Filter, X, Trash2, Menu,
  DollarSign, CheckCircle, LayoutDashboard, 
  Users, Wallet, AlertCircle, UploadCloud, TrendingUp, Activity, PieChart,
  FileText, ArrowDownToLine, Clock, AlertTriangle, Archive, FolderArchive,
  ChevronDown, MapPin, Briefcase, IdCard, Calendar as CalendarIcon, Pencil, NotebookPen, ClipboardList
} from 'lucide-react';

// --- FIREBASE SETUP ---

// As chaves do seu projeto Firebase Real (autogestor-c535c) já estão inseridas aqui!
const firebaseConfig = {
  apiKey: "AIzaSyAiJMqpzZvuNM_QsypHHHMLU84as8Gj6M8",
  authDomain: "autogestor-c535c.firebaseapp.com",
  projectId: "autogestor-c535c",
  storageBucket: "autogestor-c535c.firebasestorage.app",
  messagingSenderId: "221428036914",
  appId: "1:221428036914:web:50ddca078f257f0693132b"
};

// Initialize Firebase
let app, auth, db;

try {
  const configToUse = typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : firebaseConfig;

  app = initializeApp(configToUse);
  auth = getAuth(app);
  db = getFirestore(app);

} catch (error) {
  console.warn("Erro ao iniciar Firebase:", error);
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'auto-gestor-production';

// --- UTILS FORMATTERS ---
const formatCPF = (value) => {
  return value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
};

const formatPhone = (value) => {
  return value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{4})\d+?$/, '$1');
};

const formatMoney = (value) => {
  const cleanValue = value.toString().replace(/\D/g, '');
  if (!cleanValue) return '';
  const numberValue = parseInt(cleanValue, 10) / 100;
  return numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseMoney = (value) => {
  if (!value) return 0;
  return parseFloat(value.toString().replace(/\./g, '').replace(',', '.'));
};

const handleDownloadDocument = async (doc) => {
  try {
    let url = doc?.path || doc?.fullPath || String(doc);

    if (!url || !url.startsWith('http')) {
      alert("❌ Link do documento inválido ou arquivo antigo.");
      return;
    }

    // MÁGICA DO CLOUDINARY: Adiciona a ordem de "Forçar Download" no link
    if (url.includes('/upload/')) {
      url = url.replace('/upload/', '/upload/fl_attachment/');
    }

    // Cria um botão invisível no seu site, clica nele rapidinho e depois some com ele
    const a = document.createElement("a");
    a.href = url;
    a.download = doc?.name || "documento"; // Sugere o nome original do arquivo
    document.body.appendChild(a);
    a.click();
    a.remove();
    
  } catch (err) {
    console.error("Erro ao baixar documento:", err);
    alert("❌ Não consegui baixar o arquivo.");
  }
};

const generateInstallments = (count, firstDate, valueStr, statuses = []) => {
  if (!count || !firstDate || !valueStr) return [];
  const installments = [];
  let currentDate = new Date(firstDate);
  currentDate = new Date(currentDate.getTime() + currentDate.getTimezoneOffset() * 60000);
  const valueNum = parseMoney(valueStr);

  for (let i = 1; i <= count; i++) {
    installments.push({
      id: crypto.randomUUID(),
      number: i,
      dueDate: currentDate.toISOString().split('T')[0],
      value: valueNum,
      status: statuses[i-1] || 'pendente',
      observation: ''
    });
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  return installments;
};

// --- PDF GENERATORS (GLOBAL) ---
const printDocument = (htmlContent) => {
  const printWindow = window.open('', '_blank');
  if(printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    alert("Por favor, permita a abertura de pop-ups no seu navegador para gerar o PDF.");
  }
};

const getContractHTML = (sale, vehicle) => {
  const installments = sale.installmentsList || [];
  const totalValue = parseMoney(sale.saleValue || '0');
  const downPayment = parseMoney(sale.downPayment || '0');
  const address = sale.clientStreet ? `${sale.clientStreet}, nº ${sale.clientNumber} - ${sale.clientNeighborhood}, ${sale.clientCity}-${sale.clientState}` : (sale.clientAddress || 'Não informado');
  const dateObj = new Date(sale.saleDate);
  const day = dateObj.getUTCDate().toString().padStart(2, '0');
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const month = months[dateObj.getUTCMonth()];
  const year = dateObj.getUTCFullYear();
  const firstInstDate = installments.length > 0 ? new Date(installments[0].dueDate) : null;
  const dueDay = firstInstDate ? firstInstDate.getUTCDate().toString().padStart(2, '0') : '___';

  return `
    <!DOCTYPE html><html><head><title>Contrato - ${sale.clientName}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      @page { size: A4; margin: 12mm 15mm; }
      body { font-family: Arial, sans-serif; font-size: 11.5px; line-height: 1.4; color: #000; }
      .header { text-align: center; margin-bottom: 15px; font-weight: bold; }
      .header h2 { font-size: 14px; text-decoration: underline; font-weight: normal; margin-bottom: 5px; margin-top: 0; }
      .header h1 { font-size: 14px; margin: 0; }
      p { text-align: justify; margin-bottom: 8px; }
      u { text-decoration: underline; text-underline-offset: 2px; }
      .section-title { font-weight: bold; text-transform: uppercase; margin-top: 15px; margin-bottom: 5px; }
      .signature-section { page-break-inside: avoid; break-inside: avoid; width: 100%; margin-top: 30px; display: block; }
      .sig-table { width: 100%; margin-top: 30px; border-collapse: collapse; }
      .sig-table td { text-align: center; font-size: 12px; border: none; padding-top: 5px; width: 45%; }
      .sig-line { border-top: 1px solid #000; width: 100%; margin-bottom: 5px; }
    </style></head><body>
      <div class="header"><h2>VEÍCULOS</h2><h1>CONTRATO DE COMPRA E VENDA DE VEÍCULOS</h1></div>
      <p><u><b>VENDEDOR:</b> WARLEN PAZ, com sede à Rua Inconfidencia, 145 Bairro Centro, Betim - MG Telefone: (31)99700-3639.</u></p>
      <p><b>COMPRADOR:</b> <u>${sale.clientName}</u>, nac. <u>Brasileiro(a)</u>, estado civil: <u>${sale.clientMaritalStatus || ''}</u>, profissão: <u>${sale.clientProfession || ''}</u>, carteira identidade: <u>${sale.clientRg || ''}</u>, CPF.: <u>${sale.clientCpf}</u>, residente e domiciliado à Rua: <u>${sale.clientStreet || ''}</u>, nº <u>${sale.clientNumber || ''}</u> Bairro: <u>${sale.clientNeighborhood || ''}</u> Cidade: <u>${sale.clientCity || ''}</u> Estado: <u>${sale.clientState || ''}</u>.<br>
      As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Compra e Venda de Veículo, que se regerá pelas cláusulas seguintes e pelas condições descritas no presente.</p>
      <div class="section-title">DO OBJETO DO CONTRATO</div>
      <p>Cláusula 1ª. O presente contrato tem como OBJETO, o veículo <u>${vehicle.brand} ${vehicle.model}</u>, marca <u>${vehicle.brand}</u>, modelo <u>${vehicle.model}</u>, ano de fabricação <u>${vehicle.year}</u>, chassi <u>${vehicle.chassis || ''}</u>, cor <u>${vehicle.color || ''}</u>, placa <u>${vehicle.plate}</u>, RENAVAM: <u>${vehicle.renavam || ''}</u>, CRV: <u>${vehicle.crv || ''}</u></p>
      <div class="section-title">DAS OBRIGAÇÕES</div>
      <p>Cláusula 2ª. O VENDEDOR se obriga a entregar ao COMPRADOR o Documento Único de Transferência (DUT), assinado e a este reconhecido firma.</p>
      <p>Cláusula 3ª. O VENDEDOR se responsabilizará pela entrega do veículo ao COMPRADOR, livre de qualquer ônus ou encargos até a data presente.</p>
      <p>Cláusula 4ª. O COMPRADOR se responsabilizará, após a assinatura deste instrumento, pelos impostos, taxas, multas e mal uso que incidirem sobre o veículo.</p>
      <div class="section-title">DO PREÇO</div>
      <p>Cláusula 6ª. O COMPRADOR pagará ao VENDEDOR, pela compra do veículo objeto deste contrato, a quantia de R$ <u>${totalValue.toLocaleString('pt-BR', {minimumFractionDigits:2})}</u>, dividida em (<u>${installments.length}</u>) parcelas de R$ <u>${parseMoney(sale.installmentValue || '0').toLocaleString('pt-BR', {minimumFractionDigits:2})}</u>, a serem pagas até o dia (<u>${dueDay}</u>) de cada mês.</p>
      <p>O presente contrato, passa a valer a partir da assinatura das partes, obrigando-se a ele os herdeiros ou sucessores das mesmas.</p>
      <p><b>Obs.: <u>${sale.saleObservations || '_________________________________________________________________________________________'}</u></b></p>
      <div class="signature-section">
        <p>BETIM, <u>${day}</u> de <u>${month}</u> de <u>${year}</u>.</p>
        <table class="sig-table"><tr><td><div class="sig-line"></div>COMPRADOR</td><td style="width: 10%;"></td><td><div class="sig-line"></div>VENDEDOR</td></tr></table>
      </div>
      <script>setTimeout(() => { window.print(); }, 800);</script>
    </body></html>`;
};

const getSpreadsheetHTML = (sale, vehicle) => {
  const installments = sale.installmentsList || [];
  const downPayment = parseMoney(sale.downPayment || '0');
  const address = sale.clientStreet ? `${sale.clientStreet}, nº ${sale.clientNumber} - ${sale.clientNeighborhood}, ${sale.clientCity}-${sale.clientState}` : (sale.clientAddress || 'Não informado');
  const dateObj = new Date(sale.saleDate);
  const day = dateObj.getUTCDate().toString().padStart(2, '0');
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const month = months[dateObj.getUTCMonth()];
  const year = dateObj.getUTCFullYear();
  const firstInstDate = installments.length > 0 ? new Date(installments[0].dueDate) : null;
  const dueDay = firstInstDate ? firstInstDate.getUTCDate().toString().padStart(2, '0') : '___';

  const rowsHtml = [...installments].sort((a,b) => a.number - b.number).map(inst => `
    <tr>
      <td style="text-align: center;">${inst.number}</td>
      <td>R$ ${(inst.value || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
      <td style="text-align: center;">${new Date(inst.dueDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
      <td style="text-transform: uppercase; font-size: 11px; text-align: center;">${inst.status}</td>
      <td>${inst.observation || ''}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html><html><head><title>Planilha - ${sale.clientName}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      @page { size: A4; margin: 15mm; }
      body { font-family: Arial, sans-serif; font-size: 13px; color: #000; line-height: 1.5; }
      .header { text-align: center; margin-bottom: 20px; font-weight: bold; }
      .header h1 { font-size: 20px; margin: 0; }
      .header h2 { font-size: 16px; margin: 0; }
      p { margin-bottom: 10px; }
      u { text-decoration: underline; text-underline-offset: 2px; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
      th, td { border: 1px solid #000; padding: 6px 8px; font-size: 12px; }
      th { font-weight: bold; text-align: center; background-color: #f9f9f9; }
    </style></head><body>
      <div class="header"><h1>VEÍCULOS</h1><h2>(31)99700-3639</h2></div>
      <p>Data da Venda: <u>${day}/${dateObj.getUTCMonth()+1 < 10 ? '0'+(dateObj.getUTCMonth()+1) : dateObj.getUTCMonth()+1}/${year}</u> &nbsp;&nbsp;&nbsp; Entrada: R$ <u>${downPayment.toLocaleString('pt-BR', {minimumFractionDigits:2})}</u></p>
      <p>Valor do veículo financiado: R$ <u>${parseMoney(sale.financedAmount).toLocaleString('pt-BR', {minimumFractionDigits:2})}</u>, dividido em <u>${installments.length}</u> parcelas de R$ <u>${parseMoney(sale.installmentValue || '0').toLocaleString('pt-BR', {minimumFractionDigits:2})}</u> ( Vencimento todo dia <u>${dueDay}</u> de cada mês )</p>
      <p>Veículo: <u>${vehicle.brand} ${vehicle.model}</u>, marca <u>${vehicle.brand}</u>, modelo <u>${vehicle.model}</u>, ano de fabricação <u>${vehicle.year}</u>, chassi <u>${vehicle.chassis || ''}</u> cor <u>${vehicle.color || ''}</u>, placa <u>${vehicle.plate}</u>, RENAVAM: <u>${vehicle.renavam || ''}</u>, CRV: <u>${vehicle.crv || ''}</u></p>
      <p>Nome do Comprador: <u>${sale.clientName}</u> CPF.: <u>${sale.clientCpf}</u> Telefone: <u>${sale.clientPhone || ''}</u><br>Identidade: <u>${sale.clientRg || ''}</u> End.: <u>${address}</u></p>
      <table><thead><tr><th style="width: 8%;">Parcela</th><th style="width: 22%;">Valor da parcela</th><th style="width: 20%;">Vencimento</th><th style="width: 15%;">Status</th><th style="width: 35%;">Observações da Parcela</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      <p>Betim, <u>${day}</u> de <u>${month}</u> de <u>${year}</u>.</p>
      <script>setTimeout(() => { window.print(); }, 800);</script>
    </body></html>`;
};

const getReportHTML = (sale, vehicle) => {
  const installments = sale.installmentsList || [];
  const totalValue = parseMoney(sale.saleValue || '0');
  const downPayment = parseMoney(sale.downPayment || '0');
  const totalPaid = downPayment + installments.filter(i => i.status === 'pago').reduce((acc, i) => acc + (i.value || 0), 0);
  const remainingValue = totalValue - totalPaid;
  const address = sale.clientStreet ? `${sale.clientStreet}, nº ${sale.clientNumber} - ${sale.clientNeighborhood}, ${sale.clientCity}-${sale.clientState}` : (sale.clientAddress || 'Não informado');
  const firstInstDate = installments.length > 0 ? new Date(installments[0].dueDate) : null;
  const dueDay = firstInstDate ? firstInstDate.getUTCDate().toString().padStart(2, '0') : '---';

  const rowsHtml = [...installments].sort((a,b) => a.number - b.number).map(inst => {
    let statusColor = '#000';
    if (inst.status === 'pago') statusColor = '#16a34a'; 
    else if (inst.status === 'atrasado') statusColor = '#dc2626'; 
    else if (inst.status === 'pendente') statusColor = '#ca8a04'; 
    return `<tr><td style="text-align: center;">${inst.number}</td><td style="text-align: center;">${new Date(inst.dueDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td><td style="text-transform: uppercase; text-align: center; font-weight: bold; color: ${statusColor};">${inst.status}</td><td>${inst.observation || ''}</td></tr>`;
  }).join('');

  const dateObj = new Date();
  const day = dateObj.getUTCDate().toString().padStart(2, '0');
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const month = months[dateObj.getUTCMonth()];
  const year = dateObj.getUTCFullYear();

  return `
    <!DOCTYPE html><html><head><title>Relatório - ${sale.clientName}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      @page { size: A4; margin: 15mm; }
      body { font-family: Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #000; }
      h1 { text-align: center; font-size: 16px; margin: 0 0 10px 0; font-weight: bold; text-decoration: underline; }
      h2 { text-align: center; font-size: 14px; margin: 0 0 20px 0; font-weight: bold; text-decoration: underline; }
      .section-title { font-weight: bold; margin-top: 15px; margin-bottom: 5px; text-decoration: underline;}
      p { margin: 5px 0; }
      .bold { font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px; }
      th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; font-size: 11px; }
      th { font-weight: bold; text-align: center; background-color: #f9f9f9; }
      .footer { margin-top: 30px; text-transform: uppercase;}
      .text-green { color: #16a34a; font-weight: bold; }
      .text-red { color: #dc2626; font-weight: bold; }
    </style></head><body>
      <h1>RELATÓRIO DO CLIENTE</h1><h2>RESUMO DE PAGAMENTOS</h2>
      <div class="section-title">DADOS DO CLIENTE</div>
      <p><span class="bold">Nome:</span> ${sale.clientName}</p><p><span class="bold">CPF:</span> ${sale.clientCpf}</p><p><span class="bold">Telefone:</span> ${sale.clientPhone || 'Não informado'}</p><p><span class="bold">Endereço:</span> ${address}</p>
      <div class="section-title">DADOS DO VEÍCULO</div>
      <p><span class="bold">Veículo:</span> ${vehicle.brand} ${vehicle.model} (${vehicle.year})</p><p><span class="bold">Placa:</span> ${vehicle.plate}</p><p><span class="bold">Chassi:</span> ${vehicle.chassis || 'Não informado'}</p><p><span class="bold">Renavam:</span> ${vehicle.renavam || 'Não informado'}</p><p><span class="bold">CRV:</span> ${vehicle.crv || 'Não informado'}</p><p><span class="bold">CRLV:</span> ${vehicle.crlvNumber || 'Não informado'}</p><p><span class="bold">Cor:</span> ${vehicle.color || 'Não informado'}</p><p><span class="bold">Data da Venda:</span> ${new Date(sale.saleDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
      <div class="section-title">DADOS DO VENDEDOR</div>
      <p><span class="bold">Nome:</span> Warlen Paz</p><p><span class="bold">CPF:</span> 003.622.956-34</p>
      <div class="section-title">RESUMO FINANCEIRO</div>
      <p><span class="bold">Valor do Veículo:</span> R$ ${totalValue.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p><p><span class="bold">Valor à Vista:</span> </p><p><span class="bold">Quantidade de Parcelas:</span> ${installments.length}</p><p><span class="bold">Valor da Parcela:</span> R$ ${parseMoney(sale.installmentValue || '0').toLocaleString('pt-BR', {minimumFractionDigits:2})}</p><p><span class="bold">Dia do Vencimento:</span> ${dueDay}</p>
      <br/><p class="text-green">TOTAL PAGO ATÉ A DATA: R$ ${totalPaid.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p><p class="text-red">TOTAL EM ABERTO ATÉ A DATA: R$ ${remainingValue.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
      <div class="section-title">ANDAMENTO DAS PARCELAS</div>
      <table><thead><tr><th style="width: 10%;">Nº</th><th style="width: 25%;">VENCIMENTO</th><th style="width: 20%;">STATUS</th><th style="width: 45%; text-align: left;">OBSERVAÇÃO</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="section-title">OBSERVAÇÕES</div>
      <p>${sale.saleObservations || 'Sem observações cadastradas'}</p>
      <p class="footer">BETIM, ${day} de ${month} de ${year}</p>
      <script>setTimeout(() => { window.print(); }, 800);</script>
    </body></html>`;
};


// --- COMPONENTS ---
const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-2xl", darkHeader = false }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`${darkHeader ? 'bg-slate-900 text-white' : 'bg-white'} rounded-xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-hidden flex flex-col`}>
        <div className={`flex justify-between items-center p-6 border-b ${darkHeader ? 'border-slate-800 bg-slate-900' : 'bg-white'} z-10 shrink-0`}>
          <h2 className={`text-xl font-bold ${darkHeader ? 'text-white' : 'text-slate-800'}`}>{title}</h2>
          <button onClick={onClose} className={`${darkHeader ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'} transition-colors`}>
            <X size={24} />
          </button>
        </div>
        <div className={`p-6 overflow-y-auto scrollbar-thin ${darkHeader ? 'bg-slate-950 text-slate-300' : 'bg-white'}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

const ConfirmModal = ({ isOpen, message, onConfirm, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 text-center animate-in fade-in zoom-in duration-200">
        <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800 mb-2">Atenção!</h3>
        <p className="text-sm text-slate-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors">Cancelar</button>
          <button onClick={() => { onConfirm(); onClose(); }} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors">Excluir</button>
        </div>
      </div>
    </div>
  );
};

const AlertModal = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 text-center animate-in fade-in zoom-in duration-200">
        <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800 mb-2">Mensagem do Sistema</h3>
        <p className="text-sm text-slate-600 mb-6 whitespace-pre-wrap">{message}</p>
        <button onClick={onClose} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors">Entendi</button>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [sales, setSales] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [notes, setNotes] = useState([]);
  const [miscDocuments, setMiscDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState({ year: '', type: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [confirmAction, setConfirmAction] = useState({ isOpen: false, message: '', onConfirm: null });
  const [alertMessage, setAlertMessage] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [documentPreview, setDocumentPreview] = useState({ isOpen: false, title: '', html: '' });
  const documentFrameRef = useRef(null);

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [isManualCommissionOpen, setIsManualCommissionOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [sellPrefillClient, setSellPrefillClient] = useState(null);

  // Auth & Data Fetching (Voltou ao Firebase!)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { 
        console.error("Auth Error:", error);
        setLoading(false);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setLoading(false);
      return;
    }
    
    try {
      const vehiclesRef = collection(db, 'artifacts', appId, 'users', 'loja_global', 'vehicles');
      const unsubscribeVehicles = onSnapshot(vehiclesRef, (snapshot) => {
        setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }, (error) => console.error(error));

      const salesRef = collection(db, 'artifacts', appId, 'users', 'loja_global', 'sales');
      const unsubscribeSales = onSnapshot(salesRef, (snapshot) => {
        setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => console.error(error));

      const commissionsRef = collection(db, 'artifacts', appId, 'users', 'loja_global', 'commissions');
      const unsubscribeCommissions = onSnapshot(commissionsRef, (snapshot) => {
        setCommissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => console.error(error));

      const notesRef = collection(db, 'artifacts', appId, 'users', 'loja_global', 'notes');
      const unsubscribeNotes = onSnapshot(notesRef, (snapshot) => {
        setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => console.error(error));

      const miscDocumentsRef = collection(db, 'artifacts', appId, 'users', 'loja_global', 'misc_documents');
      const unsubscribeMiscDocuments = onSnapshot(miscDocumentsRef, (snapshot) => {
        setMiscDocuments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => console.error(error));

      return () => { unsubscribeVehicles(); unsubscribeSales(); unsubscribeCommissions(); unsubscribeNotes(); unsubscribeMiscDocuments(); };
    } catch(err) {
      console.log("Erro ao carregar coleções:", err);
      setLoading(false);
    }
  }, [user]);

  // --- AUTOMATIC INADIMPLÊNCIA CHECK (ROBOZINHO) ---
  useEffect(() => {
    if (!user || !db || sales.length === 0) return;
    
    const checkDefaulting = async () => {
      const today = new Date();
      for (const sale of sales) {
        if (sale.paymentStatus === 'em-dia' && sale.installmentsList) {
          const isDefaulting = sale.installmentsList.some(inst => {
            if (inst.status === 'atrasado') {
              const dueDate = new Date(inst.dueDate);
              const diffTime = Math.abs(today - dueDate);
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              return diffDays > 90;
            }
            return false;
          });

          if (isDefaulting) {
            try {
              const saleRef = doc(db, 'artifacts', appId, 'users', 'loja_global', 'sales', sale.id);
              await updateDoc(saleRef, { paymentStatus: 'inadimplente' });
            } catch(e) {}
          }
        }
      }
    };
    checkDefaulting();
  }, [sales, user]);

  // --- ACTIONS ---
  const checkConnection = () => {
    if (!user || !db) {
      setAlertMessage("⚠️ Conexão Pendente com o Firebase!\n\nVocê está a usar a versão do código que exige banco de dados na nuvem, mas ainda não configurou as suas chaves reais.\n\nAs ações de salvar, editar e excluir estão bloqueadas até atualizar o ficheiro App.jsx.");
      return false;
    }
    return true;
  };

  const handlePrint = (htmlContent) => {
    setDocumentPreview({
      isOpen: true,
      title: 'Visualização de Documento',
      html: htmlContent
    });
  };

  const handlePrintFromPreview = () => {
    const frameWindow = documentFrameRef.current?.contentWindow;
    if (frameWindow) frameWindow.print();
  };

  const handleToggleCommission = async (id, currentStatus) => {
    if (!checkConnection()) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', 'loja_global', 'commissions', id);
      await updateDoc(docRef, { status: currentStatus === 'pendente' ? 'paga' : 'pendente' });
    } catch (error) { console.error("Error updating commission:", error); }
  };

  const handleDeleteCommission = (id) => {
    if (!checkConnection()) return;
    setConfirmAction({
      isOpen: true,
      message: 'Tem certeza que deseja excluir esta comissão permanentemente?',
      onConfirm: async () => {
        if (!user || !db) return;
        try { await deleteDoc(doc(db, 'artifacts', appId, 'users', 'loja_global', 'commissions', id)); } 
        catch (error) { console.error("Error deleting commission:", error); }
      }
    });
  };

  const handleSaveVehicle = async (vehicleData) => {
    if (!checkConnection()) return;
    const vehiclesRef = collection(db, 'artifacts', appId, 'users', 'loja_global', 'vehicles');
    try {
      if (vehicleData.id) {
        const docRef = doc(db, 'artifacts', appId, 'users', 'loja_global', 'vehicles', vehicleData.id);
        const { id, ...dataToUpdate } = vehicleData;
        await updateDoc(docRef, dataToUpdate);
      } else {
        await addDoc(vehiclesRef, { ...vehicleData, status: 'a-venda', created_at: new Date().toISOString() });
      }
      setIsAddModalOpen(false);
      setSelectedVehicle(null);
    } catch (error) { console.error("Error saving vehicle:", error); }
  };

  const handleDeleteVehicle = (id) => {
    if (!checkConnection()) return;
    setConfirmAction({
      isOpen: true,
      message: 'Tem certeza que deseja excluir permanentemente este veículo do sistema?',
      onConfirm: async () => {
        if (!user || !db) return;
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'users', 'loja_global', 'vehicles', id));
          setIsViewModalOpen(false);
        } catch (error) { console.error("Error deleting vehicle:", error); }
      }
    });
  };

  const handleDeleteSale = (id) => {
    if (!checkConnection()) return;
    setConfirmAction({
      isOpen: true,
      message: 'Tem certeza que deseja excluir permanentemente esta venda/contrato e todo o seu histórico do sistema?',
      onConfirm: async () => {
        if (!user || !db) return;
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'users', 'loja_global', 'sales', id));
          setSelectedSaleId(null);
        } catch (error) { console.error("Error deleting sale:", error); }
      }
    });
  };

  const handleSellVehicle = async (saleData) => {
    if (!checkConnection()) return;
    try {
      const vehicleToSell = vehicles.find(v => v.id === saleData.vehicleId) || selectedVehicle;
      if (!vehicleToSell) return;

      const vehicleRef = doc(db, 'artifacts', appId, 'users', 'loja_global', 'vehicles', vehicleToSell.id);
      await updateDoc(vehicleRef, { status: 'vendido' });

      const installmentsList = generateInstallments(
        parseInt(saleData.installments) || 0, 
        saleData.firstInstallmentDate, 
        saleData.installmentValue
      );

      const salesRef = collection(db, 'artifacts', appId, 'users', 'loja_global', 'sales');
      await addDoc(salesRef, {
        vehicleId: vehicleToSell.id,
        ...saleData,
        installmentsList,
        paymentStatus: 'em-dia',
        created_at: new Date().toISOString()
      });

      const commissionValue = vehicleToSell.type === 'carro' ? 200 : 100;
      const commissionsRef = collection(db, 'artifacts', appId, 'users', 'loja_global', 'commissions');
      await addDoc(commissionsRef, {
        vehicleType: vehicleToSell.type,
        clientName: saleData.clientName,
        vehicleModel: vehicleToSell.model,
        plate: vehicleToSell.plate,
        saleDate: saleData.saleDate,
        value: commissionValue,
        status: 'pendente',
        created_at: new Date().toISOString()
      });

      setIsSellModalOpen(false);
      setIsViewModalOpen(false);
      setAlertMessage(`✅ Venda Registada com Sucesso!\n\nO contrato, a planilha e o relatório PDF já estão disponíveis para download na área de gestão.`);
    } catch (error) { console.error("Error selling vehicle:", error); }
  };

  const handleAddManualCommission = async (data) => {
    if (!checkConnection()) return;
    try {
      const commissionsRef = collection(db, 'artifacts', appId, 'users', 'loja_global', 'commissions');
      await addDoc(commissionsRef, {
        vehicleType: 'Outro',
        clientName: data.clientName,
        vehicleModel: data.description,
        plate: '---',
        saleDate: new Date().toISOString().split('T')[0],
        value: parseMoney(data.value),
        status: 'pendente',
        created_at: new Date().toISOString()
      });
      setIsManualCommissionOpen(false);
    } catch (error) { console.error("Error adding commission:", error); }
  };

  const handleSaleDragStart = (e, sale) => { e.dataTransfer.setData('saleId', sale.id); };
  const handleSaleDrop = async (e, targetStatus) => {
    e.preventDefault();
    const saleId = e.dataTransfer.getData('saleId');
    if (!saleId || !checkConnection()) return;
    const sale = sales.find(s => s.id === saleId);
    if (sale && sale.paymentStatus !== targetStatus) {
      const saleRef = doc(db, 'artifacts', appId, 'users', 'loja_global', 'sales', saleId);
      await updateDoc(saleRef, { paymentStatus: targetStatus });
    }
  };

  const handleDragStart = (e, vehicle) => { e.dataTransfer.setData('vehicleId', vehicle.id); };
  const handleDrop = async (e, targetType) => {
    e.preventDefault();
    const vehicleId = e.dataTransfer.getData('vehicleId');
    if (!vehicleId || !checkConnection()) return;
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle && vehicle.type !== targetType) {
      const vehicleRef = doc(db, 'artifacts', appId, 'users', 'loja_global', 'vehicles', vehicleId);
      await updateDoc(vehicleRef, { type: targetType });
    }
  };
  const handleDragOver = (e) => e.preventDefault();

  const handleUpdateInstallment = async (saleId, installmentId, updates) => {
    if(!checkConnection()) return;
    const sale = sales.find(s => s.id === saleId);
    if(!sale) return;
    const updatedInstallments = sale.installmentsList.map(inst => 
      inst.id === installmentId ? { ...inst, ...updates } : inst
    );
    const saleRef = doc(db, 'artifacts', appId, 'users', 'loja_global', 'sales', saleId);
    await updateDoc(saleRef, { installmentsList: updatedInstallments });
  };

  const handleUpdateSaleDetails = async (saleId, updates) => {
    if (!checkConnection()) return;
    const saleRef = doc(db, 'artifacts', appId, 'users', 'loja_global', 'sales', saleId);
    await updateDoc(saleRef, updates);
    setAlertMessage("✅ Dados do cliente atualizados com sucesso.");
  };

  const handleUpdateVehicleDetails = async (vehicleId, updates) => {
    if (!checkConnection()) return;
    const vehicleRef = doc(db, 'artifacts', appId, 'users', 'loja_global', 'vehicles', vehicleId);
    await updateDoc(vehicleRef, updates);
    setAlertMessage("✅ Dados do veículo atualizados com sucesso.");
  };

  const uploadCloudinaryFiles = async (files) => {
    const cloudName = "duzumcv9c";
    const uploadPreset = "meu_app_carros";
    return await Promise.all(
      files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", uploadPreset);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
          method: "POST",
          body: formData
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return { name: file.name, path: data.secure_url };
      })
    );
  };

  const handleSaveNote = async (noteData) => {
    if (!checkConnection()) return;
    try {
      const notesRef = collection(db, 'artifacts', appId, 'users', 'loja_global', 'notes');
      const payload = {
        title: noteData.title || '',
        content: noteData.content || '',
        done: !!noteData.done,
        updated_at: new Date().toISOString()
      };
      if (noteData.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', 'loja_global', 'notes', noteData.id), payload);
      } else {
        await addDoc(notesRef, { ...payload, created_at: new Date().toISOString() });
      }
      setAlertMessage('✅ Anotação salva com sucesso.');
    } catch (error) {
      console.error('Error saving note:', error);
      setAlertMessage('❌ Não foi possível salvar a anotação.');
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!checkConnection()) return;
    setConfirmAction({
      isOpen: true,
      message: 'Tem certeza que deseja excluir esta anotação?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'users', 'loja_global', 'notes', noteId));
        } catch (error) {
          console.error('Error deleting note:', error);
        }
      }
    });
  };

  const handleToggleNoteDone = async (noteId, currentDone) => {
    if (!checkConnection()) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', 'loja_global', 'notes', noteId), {
        done: !currentDone,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error toggling note:', error);
    }
  };

  const handleUploadMiscDocuments = async (files, description = '') => {
    if (!checkConnection()) return;
    try {
      const selectedFiles = Array.from(files || []);
      if (!selectedFiles.length) return;
      const uploadedDocs = await uploadCloudinaryFiles(selectedFiles);
      const miscDocsRef = collection(db, 'artifacts', appId, 'users', 'loja_global', 'misc_documents');
      await Promise.all(uploadedDocs.map((uploadedDoc) => addDoc(miscDocsRef, {
        ...uploadedDoc,
        description,
        created_at: new Date().toISOString()
      })));
      setAlertMessage('✅ Documento(s) diversos anexado(s) com sucesso.');
    } catch (error) {
      console.error('Error uploading misc documents:', error);
      setAlertMessage('❌ Não foi possível anexar os documentos diversos.');
    }
  };

  const handleDeleteMiscDocument = async (docId) => {
    if (!checkConnection()) return;
    setConfirmAction({
      isOpen: true,
      message: 'Tem certeza que deseja excluir este documento diverso?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'users', 'loja_global', 'misc_documents', docId));
        } catch (error) {
          console.error('Error deleting misc document:', error);
        }
      }
    });
  };

  const handleQuickSaleFromClient = (client) => {
    const stockVehicles = vehicles.filter(v => v.status === 'a-venda');
    if (stockVehicles.length === 0) {
      setAlertMessage("⚠️ Não há veículos disponíveis no estoque para iniciar a venda.");
      return;
    }
    setSelectedVehicle(stockVehicles[0]);
    setSellPrefillClient(client);
    setIsSellModalOpen(true);
  };

  // --- GLOBAL FILTERING ---
  const applyFilters = (items, isVehicle = false) => {
    const searchLower = searchQuery.toLowerCase();
    return items.filter(item => {
      const v = isVehicle ? item : vehicles.find(veh => veh.id === item.vehicleId);
      const searchMatch = isVehicle 
        ? ((v.model||'').toLowerCase().includes(searchLower) || (v.plate||'').toLowerCase().includes(searchLower) || (v.year||'').toString().includes(searchLower))
        : ((item.clientName||'').toLowerCase().includes(searchLower) || (item.clientCpf||'').includes(searchLower) || (v?.model||'').toLowerCase().includes(searchLower) || (v?.plate||'').toLowerCase().includes(searchLower));

      const typeMatch = activeFilter.type && v ? v.type === activeFilter.type : true;
      const yearMatch = activeFilter.year && v ? v.year.toString() === activeFilter.year : true;

      return searchMatch && typeMatch && yearMatch;
    });
  };

  const filteredStock = applyFilters(vehicles.filter(v => v.status === 'a-venda'), true);
  const filteredSales = applyFilters(sales);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-800">
      <ConfirmModal isOpen={confirmAction.isOpen} message={confirmAction.message} onConfirm={confirmAction.onConfirm} onClose={() => setConfirmAction({...confirmAction, isOpen: false})} />
      <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />

      {/* OVERLAY DO MENU MOBILE */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} shrink-0`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white"><Car size={24} /></div>
            <h1 className="text-xl font-bold text-white tracking-wide">AutoGestor</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg">
            <X size={24} />
          </button>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto scrollbar-thin">
          <SidebarItem icon={<PieChart size={20}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => {setActiveTab('dashboard'); setSearchQuery(''); setActiveFilter({year:'', type:''}); setIsMobileMenuOpen(false);}} />
          <SidebarItem icon={<Search size={20}/>} label="Consulta Central" active={activeTab === 'search-hub'} onClick={() => {setActiveTab('search-hub'); setSearchQuery(''); setActiveFilter({year:'', type:''}); setIsMobileMenuOpen(false);}} highlight />
          
          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estoque & Negócios</div>
          <SidebarItem icon={<LayoutDashboard size={20}/>} label="À Venda (Estoque)" active={activeTab === 'kanban'} onClick={() => {setActiveTab('kanban'); setSearchQuery(''); setActiveFilter({year:'', type:''}); setIsMobileMenuOpen(false);}} />
          <SidebarItem icon={<CheckCircle size={20}/>} label="Veículos Vendidos" active={activeTab === 'sold'} onClick={() => {setActiveTab('sold'); setSearchQuery(''); setActiveFilter({year:'', type:''}); setIsMobileMenuOpen(false);}} />
          
          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Gestão</div>
          <SidebarItem icon={<Users size={20}/>} label="Clientes" active={activeTab === 'clients'} onClick={() => {setActiveTab('clients'); setSearchQuery(''); setActiveFilter({year:'', type:''}); setIsMobileMenuOpen(false);}} />
          <SidebarItem icon={<Wallet size={20}/>} label="Controle Financeiro" active={activeTab === 'finance'} onClick={() => {setActiveTab('finance'); setIsMobileMenuOpen(false);}} />
          <SidebarItem icon={<NotebookPen size={20}/>} label="Anotações" active={activeTab === 'notes'} onClick={() => {setActiveTab('notes'); setSearchQuery(''); setIsMobileMenuOpen(false);}} />
          <SidebarItem icon={<ClipboardList size={20}/>} label="Documentos Diversos" active={activeTab === 'misc-docs'} onClick={() => {setActiveTab('misc-docs'); setSearchQuery(''); setIsMobileMenuOpen(false);}} />
          <SidebarItem icon={<DollarSign size={20}/>} label="Comissões" active={activeTab === 'commissions'} onClick={() => {setActiveTab('commissions'); setIsMobileMenuOpen(false);}} />
          
          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Histórico</div>
          <SidebarItem icon={<FolderArchive size={20}/>} label="Arquivo Morto" active={activeTab === 'archive'} onClick={() => {setActiveTab('archive'); setSearchQuery(''); setActiveFilter({year:'', type:''}); setIsMobileMenuOpen(false);}} />
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden w-full relative">
        {/* HEADER */}
        <header className="bg-white border-b px-5 md:px-8 py-4 md:py-5 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 z-10 shrink-0">
          
          <div className="flex justify-between items-start w-full">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-800">
                {activeTab === 'dashboard' && 'Visão Geral'}
                {activeTab === 'search-hub' && 'Consulta Central'}
                {activeTab === 'kanban' && 'Estoque de Veículos'}
                {activeTab === 'sold' && 'Veículos Vendidos'}
                {activeTab === 'clients' && 'Meus Clientes'}
                {activeTab === 'finance' && 'Controle Financeiro'}
                {activeTab === 'commissions' && 'Comissões de Vendas'}
                {activeTab === 'notes' && 'Anotações'}
                {activeTab === 'misc-docs' && 'Documentos Diversos'}
                {activeTab === 'archive' && 'Arquivo Morto (Quitados)'}
              </h2>
              <p className="text-xs md:text-sm text-slate-500 mt-1">
                {activeTab === 'dashboard' && 'Acompanhe os principais indicadores da sua loja.'}
                {activeTab === 'search-hub' && 'Encontre rapidamente qualquer cliente, veículo ou contrato na loja.'}
                {activeTab === 'kanban' && 'Gerencie seus carros e motos disponíveis.'}
                {activeTab === 'sold' && 'Acompanhamento de pagamentos e histórico.'}
                {activeTab === 'clients' && 'Lista de clientes e histórico completo de documentos.'}
                {activeTab === 'finance' && 'Acompanhe os valores de entrada e financiamentos.'}
                {activeTab === 'commissions' && 'Gerencie as comissões geradas pelas vendas.'}
                {activeTab === 'notes' && 'Use como bloco de notas rápido para a operação do dia a dia.'}
                {activeTab === 'misc-docs' && 'Guarde arquivos gerais que não pertencem a um cliente ou veículo específico.'}
                {activeTab === 'archive' && 'Histórico de todos os contratos já finalizados e pagos.'}
              </p>
            </div>
            
            {/* BOTÃO HAMBÚRGUER MOBILE */}
            <button 
              onClick={() => setIsMobileMenuOpen(true)} 
              className="md:hidden p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0 ml-4"
            >
              <Menu size={24} />
            </button>
          </div>
          
          {['kanban', 'sold', 'clients', 'archive', 'commissions', 'search-hub'].includes(activeTab) && (
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto mt-2 md:mt-0">
              
              {['kanban', 'sold', 'clients', 'archive', 'search-hub'].includes(activeTab) && (
                <div className="relative flex-1 xl:w-64 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder={activeTab === 'clients' ? "Buscar por nome ou CPF..." : "Buscar cliente, veículo ou placa..."}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              )}
              
              {['kanban', 'sold', 'archive', 'search-hub'].includes(activeTab) && (
                <div className="relative">
                  <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2 border rounded-lg flex items-center gap-2 transition-colors h-[38px] ${activeFilter.type || activeFilter.year ? 'bg-blue-50 border-blue-200 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}
                  >
                    <Filter size={18} />
                  </button>
                  {showFilters && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border shadow-xl rounded-xl p-4 z-20">
                      <div className="mb-3">
                        <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase">Tipo de Veículo</label>
                        <select className="w-full text-sm border rounded p-2 outline-none focus:border-blue-500" value={activeFilter.type} onChange={(e) => setActiveFilter({...activeFilter, type: e.target.value})}>
                          <option value="">Todos</option><option value="carro">Carros</option><option value="moto">Motos</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase">Ano</label>
                        <input type="number" placeholder="Ex: 2020" className="w-full text-sm border rounded p-2 outline-none focus:border-blue-500" value={activeFilter.year} onChange={(e) => setActiveFilter({...activeFilter, year: e.target.value})}/>
                      </div>
                      <button className="w-full mt-4 text-xs bg-slate-100 text-slate-600 py-2 rounded font-bold hover:bg-slate-200" onClick={() => { setActiveFilter({type: '', year: ''}); setShowFilters(false); }}>Limpar Filtros</button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'kanban' && (
                <button onClick={() => { setSelectedVehicle(null); setIsAddModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm transition-colors shrink-0 h-[38px] w-full md:w-auto justify-center">
                  <Plus size={18} /> <span>Novo Veículo</span>
                </button>
              )}
              {activeTab === 'commissions' && (
                <button onClick={() => setIsManualCommissionOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm transition-colors shrink-0 h-[38px] w-full md:w-auto justify-center">
                  <DollarSign size={18} /> <span>Adicionar Comissão</span>
                </button>
              )}
            </div>
          )}
        </header>

        {/* MAIN VIEWS */}
        {activeTab === 'dashboard' && <DashboardView vehicles={vehicles} sales={sales} clients={sales.filter(s => s.clientCpf)} />}
        
        {activeTab === 'search-hub' && (
          <GlobalSearchView 
            vehicles={vehicles} 
            sales={sales} 
            searchQuery={searchQuery} 
            activeFilter={activeFilter} 
            onDeleteVehicle={handleDeleteVehicle}
            onDeleteSale={handleDeleteSale}
            onPrint={handlePrint}
          />
        )}

        {activeTab === 'kanban' && (
          <div className="flex-1 overflow-auto p-5 md:p-8">
            <div className="flex flex-col md:flex-row gap-6 h-full items-start pb-10">
              <KanbanColumn title="Carros" icon={<Car size={20} className="text-blue-500"/>} count={filteredStock.filter(v=>v.type==='carro').length} onDrop={(e) => handleDrop(e, 'carro')} onDragOver={handleDragOver}>
                {filteredStock.filter(v=>v.type==='carro').map(v => <VehicleCard key={v.id} vehicle={v} onDragStart={handleDragStart} onClick={() => { setSelectedVehicle(v); setIsViewModalOpen(true); }} onDelete={handleDeleteVehicle} />)}
                {filteredStock.filter(v=>v.type==='carro').length === 0 && <EmptyState message="Nenhum carro encontrado." />}
              </KanbanColumn>
              <KanbanColumn title="Motos" icon={<Bike size={20} className="text-orange-500"/>} count={filteredStock.filter(v=>v.type==='moto').length} onDrop={(e) => handleDrop(e, 'moto')} onDragOver={handleDragOver}>
                {filteredStock.filter(v=>v.type==='moto').map(v => <VehicleCard key={v.id} vehicle={v} onDragStart={handleDragStart} onClick={() => { setSelectedVehicle(v); setIsViewModalOpen(true); }} onDelete={handleDeleteVehicle} />)}
                {filteredStock.filter(v=>v.type==='moto').length === 0 && <EmptyState message="Nenhuma moto encontrada." />}
              </KanbanColumn>
            </div>
          </div>
        )}

        {activeTab === 'sold' && (
          <SoldKanbanView 
            sales={filteredSales} 
            vehicles={vehicles} 
            onDragStart={handleSaleDragStart}
            onDrop={handleSaleDrop}
            onDragOver={handleDragOver}
            onSaleClick={(sale) => setSelectedSaleId(sale.id)}
            onDeleteSale={handleDeleteSale}
            onGoToArchive={() => setActiveTab('archive')}
          />
        )}
        
        {activeTab === 'clients' && <ClientsView sales={sales} searchQuery={searchQuery} onShowAlert={setAlertMessage} onQuickSell={handleQuickSaleFromClient} />}
        {activeTab === 'finance' && <FinanceView sales={sales.filter(s => s.paymentStatus !== 'quitado')} />}
        {activeTab === 'notes' && <NotesView notes={notes} searchQuery={searchQuery} onSaveNote={handleSaveNote} onDeleteNote={handleDeleteNote} onToggleDone={handleToggleNoteDone} />}
        {activeTab === 'misc-docs' && <MiscDocumentsView documents={miscDocuments} searchQuery={searchQuery} onUploadDocuments={handleUploadMiscDocuments} onDeleteDocument={handleDeleteMiscDocument} />}
        {activeTab === 'commissions' && <CommissionsView commissions={commissions} onToggleStatus={handleToggleCommission} onDelete={handleDeleteCommission} />}
        {activeTab === 'archive' && <ArchiveView sales={filteredSales} vehicles={vehicles} onSaleClick={(saleId) => setSelectedSaleId(saleId)} onDeleteSale={handleDeleteSale} />}

      </main>

      {/* MODALS */}
      <VehicleFormModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSave={handleSaveVehicle} initialData={selectedVehicle} />

      {selectedVehicle && (
        <ViewVehicleModal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          vehicle={selectedVehicle}
          onEdit={() => { setIsViewModalOpen(false); setIsAddModalOpen(true); }}
          onSell={() => { setIsViewModalOpen(false); setIsSellModalOpen(true); }}
          onDelete={() => handleDeleteVehicle(selectedVehicle.id)}
        />
      )}

      {selectedVehicle && (
        <SellVehicleModal
          isOpen={isSellModalOpen}
          onClose={() => { setIsSellModalOpen(false); setSellPrefillClient(null); }}
          vehicle={selectedVehicle}
          clients={sales}
          availableVehicles={vehicles.filter(v => v.status === 'a-venda')}
          initialClient={sellPrefillClient}
          onConfirm={handleSellVehicle}
        />
      )}

      {selectedSaleId && (
        <PaymentTrackingModal
          isOpen={!!selectedSaleId}
          onClose={() => setSelectedSaleId(null)}
          sale={sales.find(s => s.id === selectedSaleId)}
          vehicle={vehicles.find(v => v.id === sales.find(s => s.id === selectedSaleId)?.vehicleId) || {}}
          onUpdateInstallment={handleUpdateInstallment}
          onUpdateSale={handleUpdateSaleDetails}
          onUpdateVehicle={handleUpdateVehicleDetails}
          onPrint={handlePrint}
          onShowAlert={setAlertMessage}
        />
      )}

      <ManualCommissionModal isOpen={isManualCommissionOpen} onClose={() => setIsManualCommissionOpen(false)} onSave={handleAddManualCommission} />

      <Modal
        isOpen={documentPreview.isOpen}
        onClose={() => setDocumentPreview({ isOpen: false, title: '', html: '' })}
        title={documentPreview.title}
        maxWidth="max-w-6xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Use os botões abaixo para imprimir e depois voltar para o app sem fechar a tela.</p>
          <div className="flex items-center justify-end gap-3">
            <button onClick={handlePrintFromPreview} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
              Imprimir / Salvar PDF
            </button>
            <button onClick={() => setDocumentPreview({ isOpen: false, title: '', html: '' })} className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
              Voltar para o Sistema
            </button>
          </div>
          <iframe
            ref={documentFrameRef}
            title="Documento"
            srcDoc={documentPreview.html}
            className="w-full h-[70vh] rounded-xl border border-slate-200"
          />
        </div>
      </Modal>

    </div>
  );
}

// --- SUB-COMPONENTS ---
const SidebarItem = ({ icon, label, active, disabled, onClick, highlight }) => (
  <button 
    onClick={disabled ? undefined : onClick}
    className={`w-full flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-lg transition-colors text-sm font-medium
      ${active ? (highlight ? 'bg-indigo-600 text-white shadow-md' : 'bg-blue-600/10 text-blue-400') : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    `}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const KanbanColumn = ({ title, icon, count, children, onDrop, onDragOver, bgClass = "bg-slate-100", borderClass = "border-slate-200/60" }) => (
  <div 
    className={`w-full md:flex-1 md:w-1/3 ${bgClass} rounded-2xl p-4 flex flex-col max-h-full border ${borderClass} shadow-sm shrink-0`}
    onDrop={onDrop}
    onDragOver={onDragOver}
  >
    <div className="flex items-center justify-between mb-4 px-2 shrink-0">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-bold text-slate-700">{title}</h3>
      </div>
      <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded-full">{count}</span>
    </div>
    <div className="overflow-y-auto space-y-3 pr-2 scrollbar-thin pb-4 flex-1">
      {children}
    </div>
  </div>
);

const VehicleCard = ({ vehicle, onDragStart, onClick, onDelete }) => (
  <div 
    draggable
    onDragStart={(e) => onDragStart(e, vehicle)}
    onClick={onClick}
    className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-blue-300 transition-all relative group overflow-hidden"
  >
    <button onClick={(e) => { e.stopPropagation(); onDelete(vehicle.id); }} className="absolute top-2 right-2 text-slate-200 hover:text-red-500 hover:bg-red-50 p-1.5 rounded z-10 transition-colors">
      <Trash2 size={16}/>
    </button>
    <div className="flex items-start gap-2 mb-2 pr-6 min-w-0">
      <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2 min-w-0 flex-1 break-words">
        {vehicle.brand} {vehicle.model}
      </h4>
      <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap ml-2">
        {vehicle.year}
      </span>
    </div>
    
    <div className="text-xs text-slate-500 mb-3 flex flex-col gap-1 border-b border-slate-100 pb-2 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 min-w-0">
        <span className="break-words">Cor: {vehicle.color || 'N/D'}</span>
        <span className="shrink-0">Chassi: {vehicle.chassis ? 'OK' : 'Pendente'}</span>
      </div>
      {vehicle.documents && vehicle.documents.length > 0 && (
        <span className="flex items-center gap-1 text-blue-600 font-medium mt-1 min-w-0">
          <FileText size={12} className="shrink-0"/> <span className="break-words">{vehicle.documents.length} anexo(s)</span>
        </span>
      )}
    </div>

    <div className="flex items-end justify-between text-sm gap-3 min-w-0">
      <div className="flex flex-col min-w-0">
        <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Placa</span>
        <span className="text-slate-700 font-mono font-medium break-all">{vehicle.plate || '---'}</span>
      </div>
      <div className="flex flex-col items-end shrink-0 text-right">
        <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Preço</span>
        <span className="text-slate-900 font-bold">
          {vehicle.price ? `R$ ${parseMoney(vehicle.price).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : 'Sob consulta'}
        </span>
      </div>
    </div>
  </div>
);

const EmptyState = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
    <AlertCircle size={32} className="mb-2 opacity-50" />
    <p className="text-sm font-medium text-center">{message}</p>
  </div>
);

const VehicleFormModal = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState({
    type: 'carro', brand: '', model: '', year: '', plate: '', 
    color: '', price: '', renavam: '', crv: '', chassis: '', crlvNumber: '', notes: '', documents: []
  });

  useEffect(() => {
    if (initialData) setFormData(initialData);
    else setFormData({ type: 'carro', brand: '', model: '', year: '', plate: '', color: '', price: '', renavam: '', crv: '', chassis: '', crlvNumber: '', notes: '', documents: [] });
  }, [initialData, isOpen]);

  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === 'price') value = formatMoney(value);
    setFormData({ ...formData, [name]: value });
  };

const handleFileUpload = async (e) => {
  try {
    const selectedFiles = Array.from(e.target.files || []);

    if (!selectedFiles.length) {
      onShowAlert("Nenhum arquivo selecionado.");
      return;
    }

    const cloudName = "duzumcv9c"; 
    const uploadPreset = "meu_app_carros"; 

    const uploadedDocs = await Promise.all(
      selectedFiles.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", uploadPreset);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
          method: "POST",
          body: formData
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error.message);

        return {
          name: file.name,
          path: data.secure_url 
        };
      })
    );

    setFormData((prev) => ({
      ...prev,
      documents: [...(prev.documents || []), ...uploadedDocs],
    }));

    onShowAlert("✅ Arquivo(s) anexado(s) com sucesso.");
    e.target.value = "";
  } catch (error) {
    console.error("Erro no upload pro Cloudinary:", error);
    onShowAlert("❌ Não consegui anexar o arquivo.");
  }
};

  const removeDocument = (index) => {
    const newDocs = [...(formData.documents || [])];
    newDocs.splice(index, 1);
    setFormData({ ...formData, documents: newDocs });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Editar Veículo" : "Adicionar Veículo"}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-full mb-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de Veículo</label>
            <div className="flex gap-4">
              <label className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${formData.type === 'carro' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200' : 'hover:bg-slate-50'}`}>
                <input type="radio" name="type" value="carro" checked={formData.type === 'carro'} onChange={handleChange} className="hidden"/>
                <Car size={20} /> Carro
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${formData.type === 'moto' ? 'border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-200' : 'hover:bg-slate-50'}`}>
                <input type="radio" name="type" value="moto" checked={formData.type === 'moto'} onChange={handleChange} className="hidden"/>
                <Bike size={20} /> Moto
              </label>
            </div>
          </div>

          <Input label="Marca" name="brand" value={formData.brand} onChange={handleChange} required placeholder="Ex: Honda, Toyota" />
          <Input label="Modelo" name="model" value={formData.model} onChange={handleChange} required placeholder="Ex: Civic EXL" />
          <Input label="Ano (Fab/Mod)" name="year" type="number" value={formData.year} onChange={handleChange} required placeholder="Ex: 2022" />
          <Input label="Placa" name="plate" value={formData.plate} onChange={handleChange} required placeholder="ABC-1234" />
          <Input label="Cor" name="color" value={formData.color} onChange={handleChange} />
          <Input label="Preço (R$)" name="price" type="text" value={formData.price} onChange={handleChange} placeholder="0,00" />
          <Input label="Renavam" name="renavam" value={formData.renavam} onChange={handleChange} />
          <Input label="CRV" name="crv" value={formData.crv || ''} onChange={handleChange} />
          <Input label="Chassi" name="chassis" value={formData.chassis} onChange={handleChange} />
          
          <div className="col-span-full mt-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Documentos e Anexos</label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-slate-500 bg-slate-50 relative hover:bg-slate-100 transition-colors cursor-pointer">
              <input
  type="file"
  multiple
  onChange={handleFileUpload}
  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
/>
              <span className="text-sm font-medium">Clique ou arraste ficheiros para anexar</span>
            </div>
            
           {(formData.documents || []).length > 0 && (
  <div className="mt-3 space-y-2">
    {formData.documents.map((doc, i) => (
      <div
        key={i}
        className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-lg text-sm"
      >
        <span className="flex items-center gap-2 text-slate-600 font-medium">
          <FileText size={16} className="text-blue-500" />
          {doc?.name || doc}
        </span>

        <button
          type="button"
          onClick={() => removeDocument(i)}
          className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    ))}
  </div>
)}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
          <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors">
            {initialData ? 'Atualizar Veículo' : 'Cadastrar Veículo'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const ViewVehicleModal = ({ isOpen, onClose, vehicle, onEdit, onSell, onDelete }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do Veículo">
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {vehicle.type === 'carro' ? <Car size={24} className="text-blue-600"/> : <Bike size={24} className="text-orange-600"/>}
              <h2 className="text-2xl font-bold text-slate-800">{vehicle.brand} {vehicle.model}</h2>
            </div>
            <div className="flex gap-3 text-sm font-medium">
              <span className="bg-slate-100 px-2 py-1 rounded text-slate-700">{vehicle.year}</span>
              <span className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-mono">{vehicle.plate}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="block text-sm text-slate-500 font-semibold uppercase tracking-wide">Valor de Venda</span>
            <span className="text-3xl font-bold text-green-600">R$ {parseMoney(vehicle.price || '0').toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div><span className="block text-xs text-slate-400 uppercase font-semibold mb-1">Cor</span><span className="font-medium text-slate-700">{vehicle.color || '---'}</span></div>
          <div><span className="block text-xs text-slate-400 uppercase font-semibold mb-1">Renavam</span><span className="font-medium text-slate-700">{vehicle.renavam || '---'}</span></div>
          <div><span className="block text-xs text-slate-400 uppercase font-semibold mb-1">CRV</span><span className="font-medium text-slate-700">{vehicle.crv || '---'}</span></div>
          <div className="col-span-2 sm:col-span-1"><span className="block text-xs text-slate-400 uppercase font-semibold mb-1">Chassi</span><span className="font-medium text-slate-700 break-all">{vehicle.chassis || '---'}</span></div>
        </div>

        {vehicle.documents && vehicle.documents.length > 0 && (
          <div className="pt-2">
            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><FileText size={18}/> Documentos Anexados</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {vehicle.documents.map((doc, i) => (
                <div 
                  key={i} 
                  onClick={() => handleDownloadDocument(doc)} 
                  className="flex items-center gap-3 bg-white border border-slate-200 p-3 rounded-lg text-sm cursor-pointer hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors shadow-sm"
                >
                  <div className="bg-blue-100 p-2 rounded text-blue-600"><FileText size={16} /></div>
                  <span className="font-medium truncate flex-1">{doc?.name || doc}</span>
                  <ArrowDownToLine size={16} className="text-slate-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t mt-6">
          <button onClick={(e) => { e.preventDefault(); onDelete(vehicle.id); }} className="w-full sm:w-auto px-4 py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2">
            <Trash2 size={18}/> Excluir
          </button>
          <div className="flex w-full sm:w-auto gap-3">
            <button onClick={onEdit} className="flex-1 sm:flex-none px-6 py-2.5 border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 rounded-lg">Editar</button>
            <button onClick={onSell} className="flex-1 sm:flex-none px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-sm flex items-center justify-center gap-2"><DollarSign size={18} /> Vender Veículo</button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

const SellVehicleModal = ({ isOpen, onClose, vehicle, onConfirm, clients = [], availableVehicles = [], initialClient = null }) => {
  const [sellData, setSellData] = useState({
    vehicleId: vehicle?.id || '',
    clientName: '', clientPhone: '', clientCpf: '', clientRg: '', 
    clientBirthDate: '', clientMaritalStatus: 'SOLTEIRO', clientProfession: '',
    clientStreet: '', clientNumber: '', clientNeighborhood: '', clientCity: '', clientState: '',
    clientDocuments: [],
    saleDate: new Date().toISOString().split('T')[0],
    saleValue: vehicle?.price || '', financedAmount: '', downPayment: '',
    installments: '', installmentValue: '', firstInstallmentDate: '', saleObservations: ''
  });
  const [selectedClientCpf, setSelectedClientCpf] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setSellData(prev => ({
      ...prev,
      vehicleId: vehicle?.id || prev.vehicleId || '',
      saleValue: vehicle?.price || prev.saleValue || ''
    }));
    setSelectedClientCpf('');
  }, [isOpen, vehicle]);

  useEffect(() => {
    if (!isOpen || !initialClient) return;
    setSelectedClientCpf(initialClient.clientCpf || '');
    setSellData(prev => ({
      ...prev,
      clientName: initialClient.clientName || '',
      clientPhone: initialClient.clientPhone || '',
      clientCpf: initialClient.clientCpf || '',
      clientRg: initialClient.clientRg || '',
      clientBirthDate: initialClient.clientBirthDate || '',
      clientMaritalStatus: initialClient.clientMaritalStatus || 'SOLTEIRO',
      clientProfession: initialClient.clientProfession || '',
      clientStreet: initialClient.clientStreet || '',
      clientNumber: initialClient.clientNumber || '',
      clientNeighborhood: initialClient.clientNeighborhood || '',
      clientCity: initialClient.clientCity || '',
      clientState: initialClient.clientState || '',
      clientDocuments: initialClient.documents || initialClient.clientDocuments || []
    }));
  }, [isOpen, initialClient]);

  const uniqueClients = Array.from(
    clients.reduce((map, sale) => {
      if (!sale.clientCpf) return map;
      if (!map.has(sale.clientCpf)) map.set(sale.clientCpf, sale);
      return map;
    }, new Map()).values()
  );

  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === 'clientCpf') value = formatCPF(value);
    if (name === 'clientPhone') value = formatPhone(value);
    if (['saleValue', 'financedAmount', 'downPayment', 'installmentValue'].includes(name)) value = formatMoney(value);
    setSellData({ ...sellData, [name]: value });
  };

const handleClientFileUpload = async (e) => {
  try {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    const cloudName = "duzumcv9c"; 
    const uploadPreset = "meu_app_carros";

    const uploadedDocs = await Promise.all(
      selectedFiles.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", uploadPreset);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
          method: "POST",
          body: formData
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        return {
          name: file.name,
          path: data.secure_url
        };
      })
    );

    setSellData({
      ...sellData,
      clientDocuments: [...(sellData.clientDocuments || []), ...uploadedDocs]
    });
  } catch (error) {
    console.error("Erro no upload de cliente pro Cloudinary:", error);
  }
};

  const removeClientDocument = (index) => {
    const newDocs = [...(sellData.clientDocuments || [])];
    newDocs.splice(index, 1);
    setSellData({ ...sellData, clientDocuments: newDocs });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(sellData);
  };

  const handleClientSelection = (cpf) => {
    setSelectedClientCpf(cpf);
    if (!cpf) return;
    const chosenClient = uniqueClients.find(client => client.clientCpf === cpf);
    if (!chosenClient) return;
    setSellData(prev => ({
      ...prev,
      clientName: chosenClient.clientName || '',
      clientPhone: chosenClient.clientPhone || '',
      clientCpf: chosenClient.clientCpf || '',
      clientRg: chosenClient.clientRg || '',
      clientBirthDate: chosenClient.clientBirthDate || '',
      clientMaritalStatus: chosenClient.clientMaritalStatus || 'SOLTEIRO',
      clientProfession: chosenClient.clientProfession || '',
      clientStreet: chosenClient.clientStreet || '',
      clientNumber: chosenClient.clientNumber || '',
      clientNeighborhood: chosenClient.clientNeighborhood || '',
      clientCity: chosenClient.clientCity || '',
      clientState: chosenClient.clientState || '',
      clientDocuments: chosenClient.clientDocuments || []
    }));
  };

  const handleVehicleSelection = (vehicleId) => {
    const chosenVehicle = availableVehicles.find(v => v.id === vehicleId);
    setSellData(prev => ({
      ...prev,
      vehicleId,
      saleValue: chosenVehicle?.price || prev.saleValue
    }));
  };

  if (!vehicle) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Venda & Contrato" maxWidth="max-w-5xl">
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between">
          <div><span className="text-xs font-bold text-blue-600 uppercase">Veículo Selecionado</span><h3 className="font-bold text-slate-800 text-lg">{vehicle.brand} {vehicle.model} ({vehicle.year})</h3></div>
          <div className="font-mono text-slate-600 bg-white px-3 py-1 rounded border border-blue-100">{vehicle.plate}</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h4 className="font-bold text-slate-800 border-b pb-2 flex items-center gap-2"><IdCard size={18}/> Qualificação do Comprador</h4>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Cliente já cadastrado</label>
              <select
                value={selectedClientCpf}
                onChange={(e) => handleClientSelection(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm bg-white"
              >
                <option value="">Selecionar cliente existente (opcional)</option>
                {uniqueClients.map(client => (
                  <option key={client.clientCpf} value={client.clientCpf}>
                    {client.clientName} - {client.clientCpf}
                  </option>
                ))}
              </select>
            </div>
            
            <Input label="Nome Completo" name="clientName" value={sellData.clientName} onChange={handleChange} required />
            
            <div className="grid grid-cols-2 gap-4">
              <Input label="CPF" name="clientCpf" value={sellData.clientCpf} onChange={handleChange} required maxLength={14} placeholder="000.000.000-00"/>
              <Input label="Identidade (RG)" name="clientRg" value={sellData.clientRg} onChange={handleChange} placeholder="MG-00.000.000"/>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <Input label="Data Nascimento" type="date" name="clientBirthDate" value={sellData.clientBirthDate} onChange={handleChange} />
              <div className="flex flex-col">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Estado Civil</label>
                <div className="relative">
                  <select name="clientMaritalStatus" value={sellData.clientMaritalStatus} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-blue-500 appearance-none bg-white text-sm">
                    <option value="SOLTEIRO">Solteiro(a)</option><option value="CASADO">Casado(a)</option>
                    <option value="DIVORCIADO">Divorciado(a)</option><option value="VIUVO">Viúvo(a)</option>
                    <option value="UNIAO_ESTAVEL">União Estável</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                </div>
              </div>
              <Input label="Profissão" name="clientProfession" value={sellData.clientProfession} onChange={handleChange} placeholder="Ex: Médico"/>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Input label="Telefone" name="clientPhone" value={sellData.clientPhone} onChange={handleChange} required maxLength={15} placeholder="(00) 00000-0000"/></div>
            </div>

            <h4 className="font-bold text-slate-800 border-b pb-2 flex items-center gap-2 mt-6"><MapPin size={18}/> Endereço do Comprador</h4>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3"><Input label="Rua / Avenida" name="clientStreet" value={sellData.clientStreet} onChange={handleChange} /></div>
              <Input label="Número" name="clientNumber" value={sellData.clientNumber} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Bairro" name="clientNeighborhood" value={sellData.clientNeighborhood} onChange={handleChange} />
              <Input label="Cidade" name="clientCity" value={sellData.clientCity} onChange={handleChange} />
              <Input label="Estado (UF)" name="clientState" value={sellData.clientState} onChange={handleChange} maxLength={2} placeholder="MG"/>
            </div>

            <h4 className="font-bold text-slate-800 border-b pb-2 flex items-center gap-2 mt-6"><FolderArchive size={18}/> Documentos do Cliente</h4>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-slate-500 bg-slate-50 relative hover:bg-slate-100 transition-colors cursor-pointer">
              <input type="file" multiple onChange={handleClientFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <UploadCloud size={24} className="mb-1" />
              <span className="text-sm font-medium">Clique ou arraste RG, CNH, Comprovante de Residência...</span>
            </div>
            {(sellData.clientDocuments || []).length > 0 && (
              <div className="mt-3 space-y-2">
                {sellData.clientDocuments.map((docName, i) => (
                  <div key={i} className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-lg text-sm">
                    <span className="flex items-center gap-2 text-slate-600 font-medium"><IdCard size={16} className="text-indigo-500"/> {docName?.name || docName}</span>
                    <button type="button" onClick={() => removeClientDocument(i)} className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors"><X size={16}/></button>
                  </div>
                ))}
              </div>
            )}

          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-slate-800 border-b pb-2 flex items-center gap-2"><Wallet size={18}/> Condições de Pagamento</h4>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Veículo já cadastrado</label>
              <select
                value={sellData.vehicleId}
                onChange={(e) => handleVehicleSelection(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm bg-white"
                required
              >
                {availableVehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.brand} {v.model} - {v.plate} ({v.year})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Data da Venda" name="saleDate" type="date" value={sellData.saleDate} onChange={handleChange} required />
              <Input label="Valor Total (R$)" name="saleValue" type="text" value={sellData.saleValue} onChange={handleChange} required placeholder="0,00" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Valor da Entrada (R$)" name="downPayment" type="text" value={sellData.downPayment} onChange={handleChange} placeholder="0,00"/>
              <Input label="Valor Financiado (R$)" name="financedAmount" type="text" value={sellData.financedAmount} onChange={handleChange} placeholder="0,00"/>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-2">
              <span className="text-xs font-bold text-slate-500 mb-3 block uppercase">Geração de Parcelas (Planilha)</span>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Nº de Parcelas" name="installments" type="number" value={sellData.installments} onChange={handleChange} />
                <Input label="Valor da Parcela (R$)" name="installmentValue" type="text" value={sellData.installmentValue} onChange={handleChange} placeholder="0,00"/>
              </div>
              <div className="mt-3">
                <Input label="Vencimento 1ª Parcela" name="firstInstallmentDate" type="date" value={sellData.firstInstallmentDate} onChange={handleChange} />
              </div>
            </div>

            <div className="mt-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Observações do Contrato</label>
              <textarea 
                name="saleObservations" 
                value={sellData.saleObservations} 
                onChange={handleChange} 
                rows="3" 
                className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm"
                placeholder="Condições especiais, promissórias adicionais, garantias..."
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t mt-4">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancelar</button>
          <button type="submit" className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-sm flex items-center gap-2">
            <CheckCircle size={20} /> Confirmar Venda & Gerar Documentos
          </button>
        </div>
      </form>
    </Modal>
  );
};

const ManualCommissionModal = ({ isOpen, onClose, onSave }) => {
  const [data, setData] = useState({ clientName: '', description: '', value: '' });
  const handleChange = (e) => {
    let { name, value } = e.target;
    if(name === 'value') value = formatMoney(value);
    setData({...data, [name]: value});
  };
  const handleSubmit = (e) => { e.preventDefault(); onSave(data); };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lançar Comissão Avulsa" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Cliente (Referência)" name="clientName" value={data.clientName} onChange={handleChange} required />
        <Input label="Descrição / Veículo" name="description" value={data.description} onChange={handleChange} required />
        <Input label="Valor da Comissão (R$)" name="value" value={data.value} onChange={handleChange} required placeholder="0,00" />
        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancelar</button>
          <button type="submit" className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg shadow-sm transition-colors">Salvar Comissão</button>
        </div>
      </form>
    </Modal>
  );
};

const PaymentTrackingModal = ({ isOpen, onClose, sale, vehicle, onUpdateInstallment, onUpdateSale, onUpdateVehicle, onPrint, onShowAlert }) => {
  const totalValue = parseMoney(sale?.saleValue || '0');
  const downPayment = parseMoney(sale?.downPayment || '0');
  const installments = sale?.installmentsList || [];
  const paidCount = installments.filter(i => i.status === 'pago').length;
  const progressPercent = installments.length > 0 ? (paidCount / installments.length) * 100 : 100;
  const totalPaid = downPayment + installments.filter(i => i.status === 'pago').reduce((acc, i) => acc + (i.value || 0), 0);
  const remainingValue = totalValue - totalPaid;

  const handleStatusChange = (instId, newStatus) => {
    if (!sale?.id) return;
    onUpdateInstallment(sale.id, instId, { status: newStatus });
  };
  const handleObsChange = (instId, text) => {
    if (!sale?.id) return;
    onUpdateInstallment(sale.id, instId, { observation: text });
  };
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [isEditingFinancial, setIsEditingFinancial] = useState(false);
  const [clientData, setClientData] = useState({});
  const [vehicleData, setVehicleData] = useState({});
  const [financialData, setFinancialData] = useState({});

  useEffect(() => {
    if (!sale) return;
    setClientData({
      clientName: sale.clientName || '',
      clientCpf: sale.clientCpf || '',
      clientPhone: sale.clientPhone || '',
      clientRg: sale.clientRg || '',
      clientMaritalStatus: sale.clientMaritalStatus || '',
      clientStreet: sale.clientStreet || '',
      clientNumber: sale.clientNumber || '',
      clientNeighborhood: sale.clientNeighborhood || '',
      clientCity: sale.clientCity || '',
      clientState: sale.clientState || ''
    });
    setVehicleData({
      brand: vehicle.brand || '',
      model: vehicle.model || '',
      year: vehicle.year || '',
      plate: vehicle.plate || '',
      color: vehicle.color || '',
      renavam: vehicle.renavam || '',
      crv: vehicle.crv || '',
      chassis: vehicle.chassis || ''
    });
    setFinancialData({
      saleValue: sale.saleValue || '',
      downPayment: sale.downPayment || '',
      financedAmount: sale.financedAmount || '',
      installments: sale.installmentsList?.length || sale.installments || '',
      installmentValue: sale.installmentValue || '',
      firstInstallmentDate: sale.firstInstallmentDate || ''
    });
    setIsEditingClient(false);
    setIsEditingVehicle(false);
    setIsEditingFinancial(false);
  }, [sale, vehicle]);

  const saveClientDetails = async () => {
    if (!sale?.id) return;
    await onUpdateSale(sale.id, clientData);
    setIsEditingClient(false);
  };

  const saveVehicleDetails = async () => {
    if (!vehicle?.id) return;
    await onUpdateVehicle(vehicle.id, vehicleData);
    setIsEditingVehicle(false);
  };

  const saveFinancialDetails = async () => {
    if (!sale?.id) return;

    const totalValueNum = parseMoney(financialData.saleValue || sale.saleValue || '0');
    const downPaymentNum = parseMoney(financialData.downPayment || sale.downPayment || '0');
    const financedAmountNum = parseMoney(financialData.financedAmount || '0');
    const installmentsCount = Math.max(parseInt(financialData.installments || 0, 10) || 0, 0);
    const installmentValueNum = parseMoney(financialData.installmentValue || sale.installmentValue || '0');
    const firstDate = financialData.firstInstallmentDate || sale.firstInstallmentDate || '';

    const resolvedFinancedAmount = financedAmountNum > 0
      ? financedAmountNum
      : Math.max(totalValueNum - downPaymentNum, 0);

    let updatedInstallmentsList = [];

    if (installmentsCount > 0 && firstDate && installmentValueNum > 0) {
      const existingInstallments = sale.installmentsList || [];
      let currentDate = new Date(firstDate);
      currentDate = new Date(currentDate.getTime() + currentDate.getTimezoneOffset() * 60000);

      updatedInstallmentsList = Array.from({ length: installmentsCount }, (_, index) => {
        const existing = existingInstallments[index];
        const item = {
          id: existing?.id || crypto.randomUUID(),
          number: index + 1,
          dueDate: currentDate.toISOString().split('T')[0],
          value: installmentValueNum,
          status: existing?.status || 'pendente',
          observation: existing?.observation || ''
        };
        currentDate.setMonth(currentDate.getMonth() + 1);
        return item;
      });
    }

    await onUpdateSale(sale.id, {
      saleValue: totalValueNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      downPayment: downPaymentNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      financedAmount: resolvedFinancedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      installments: installmentsCount,
      installmentValue: installmentValueNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      firstInstallmentDate: firstDate,
      installmentsList: updatedInstallmentsList
    });

    setIsEditingFinancial(false);
  };

  const uploadCloudinaryFiles = async (files) => {
    const cloudName = "duzumcv9c";
    const uploadPreset = "meu_app_carros";
    const uploadedDocs = await Promise.all(
      files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", uploadPreset);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
          method: "POST",
          body: formData
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return { name: file.name, path: data.secure_url };
      })
    );
    return uploadedDocs;
  };

  const handleAppendVehicleDocuments = async (e) => {
    try {
      const selectedFiles = Array.from(e.target.files || []);
      if (!selectedFiles.length || !vehicle?.id) return;
      const uploadedDocs = await uploadCloudinaryFiles(selectedFiles);
      await onUpdateVehicle(vehicle.id, { documents: [...(vehicle.documents || []), ...uploadedDocs] });
      if (onShowAlert) onShowAlert("✅ Documentos do veículo anexados com sucesso.");
      e.target.value = '';
    } catch (error) {
      console.error("Erro ao anexar documento do veículo:", error);
      if (onShowAlert) onShowAlert("❌ Não foi possível anexar documento do veículo.");
    }
  };

  const handleAppendClientDocuments = async (e) => {
    try {
      const selectedFiles = Array.from(e.target.files || []);
      if (!selectedFiles.length || !sale?.id) return;
      const uploadedDocs = await uploadCloudinaryFiles(selectedFiles);
      await onUpdateSale(sale.id, { clientDocuments: [...(sale.clientDocuments || []), ...uploadedDocs] });
      if (onShowAlert) onShowAlert("✅ Documentos do cliente anexados com sucesso.");
      e.target.value = '';
    } catch (error) {
      console.error("Erro ao anexar documento do cliente:", error);
      if (onShowAlert) onShowAlert("❌ Não foi possível anexar documento do cliente.");
    }
  };

  const handleRemoveVehicleDocument = async (indexToRemove) => {
    if (!vehicle?.id) return;
    const shouldDelete = window.confirm("Remover este documento do veículo?");
    if (!shouldDelete) return;
    try {
      const updatedDocs = (vehicle.documents || []).filter((_, index) => index !== indexToRemove);
      await onUpdateVehicle(vehicle.id, { documents: updatedDocs });
      if (onShowAlert) onShowAlert("✅ Documento do veículo removido.");
    } catch (error) {
      console.error("Erro ao remover documento do veículo:", error);
      if (onShowAlert) onShowAlert("❌ Não foi possível remover o documento do veículo.");
    }
  };

  const handleRemoveClientDocument = async (indexToRemove) => {
    if (!sale?.id) return;
    const shouldDelete = window.confirm("Remover este documento do cliente?");
    if (!shouldDelete) return;
    try {
      const updatedDocs = (sale.clientDocuments || []).filter((_, index) => index !== indexToRemove);
      await onUpdateSale(sale.id, { clientDocuments: updatedDocs });
      if (onShowAlert) onShowAlert("✅ Documento do cliente removido.");
    } catch (error) {
      console.error("Erro ao remover documento do cliente:", error);
      if (onShowAlert) onShowAlert("❌ Não foi possível remover o documento do cliente.");
    }
  };

  if (!sale) return null;

  const getStatusColor = (status) => {
    if (status === 'pago') return 'bg-green-100 text-green-800 border-green-300';
    if (status === 'atrasado') return 'bg-red-100 text-red-800 border-red-300';
    return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestão de Contrato e Pagamentos" maxWidth="max-w-6xl">
      <div className="space-y-6">
        
        {/* HEADER & ACTION BUTTONS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
              {sale.paymentStatus === 'quitado' ? 'Contrato Quitado' : sale.paymentStatus === 'inadimplente' ? 'Em Atraso' : 'Pagamento Em Dia'}
            </span>
            <p className="text-slate-500 text-sm mt-2">Registado a {new Date(sale.saleDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto mt-2 md:mt-0">
            <button onClick={() => onPrint(getContractHTML(sale, vehicle))} className="flex-1 md:flex-none justify-center bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm whitespace-nowrap">
              <FileText size={16} className="text-blue-600 shrink-0"/> Contrato
            </button>
            <button onClick={() => onPrint(getSpreadsheetHTML(sale, vehicle))} className="flex-1 md:flex-none justify-center bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm whitespace-nowrap">
              <ArrowDownToLine size={16} className="text-emerald-600 shrink-0"/> Planilha
            </button>
            <button onClick={() => onPrint(getReportHTML(sale, vehicle))} className="flex-1 md:flex-none justify-center bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm whitespace-nowrap">
              <Activity size={16} className="text-purple-600 shrink-0"/> Relatório
            </button>
          </div>
        </div>

        {/* INFO GRID - MAXIMUM INFO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
              <h4 className="flex items-center gap-2 text-slate-800 font-bold"><Users size={18} className="text-blue-500"/> Dados do Cliente</h4>
              <button onClick={() => setIsEditingClient(prev => !prev)} className={`p-1.5 rounded-lg border transition-colors ${isEditingClient ? 'bg-slate-200 border-slate-400 text-slate-700' : 'bg-white border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400'}`} title="Editar dados do cliente">
                <Pencil size={14} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div><span className="block text-xs text-slate-500 font-semibold uppercase">Nome</span>{isEditingClient ? <input value={clientData.clientName || ''} onChange={(e) => setClientData({...clientData, clientName: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2 text-sm" /> : <span className="font-medium text-slate-800">{sale.clientName}</span>}</div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="block text-xs text-slate-500 font-semibold uppercase">CPF</span>{isEditingClient ? <input value={clientData.clientCpf || ''} onChange={(e) => setClientData({...clientData, clientCpf: formatCPF(e.target.value)})} className="w-full border border-slate-300 rounded-lg p-2 text-sm font-mono" /> : <span className="font-medium text-slate-800 font-mono">{sale.clientCpf}</span>}</div>
                <div><span className="block text-xs text-slate-500 font-semibold uppercase">Telefone</span>{isEditingClient ? <input value={clientData.clientPhone || ''} onChange={(e) => setClientData({...clientData, clientPhone: formatPhone(e.target.value)})} className="w-full border border-slate-300 rounded-lg p-2 text-sm" /> : <span className="font-medium text-slate-800">{sale.clientPhone}</span>}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="block text-xs text-slate-500 font-semibold uppercase">Identidade (RG)</span>{isEditingClient ? <input value={clientData.clientRg || ''} onChange={(e) => setClientData({...clientData, clientRg: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2 text-sm" /> : <span className="font-medium text-slate-800">{sale.clientRg || 'N/D'}</span>}</div>
                <div><span className="block text-xs text-slate-500 font-semibold uppercase">Estado Civil</span>{isEditingClient ? <input value={clientData.clientMaritalStatus || ''} onChange={(e) => setClientData({...clientData, clientMaritalStatus: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2 text-sm" /> : <span className="font-medium text-slate-800">{sale.clientMaritalStatus || 'N/D'}</span>}</div>
              </div>
              <div>
                <span className="block text-xs text-slate-500 font-semibold uppercase">Endereço</span>
                {isEditingClient ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input value={clientData.clientStreet || ''} onChange={(e) => setClientData({...clientData, clientStreet: e.target.value})} placeholder="Rua" className="col-span-2 w-full border border-slate-300 rounded-lg p-2 text-sm" />
                    <input value={clientData.clientNumber || ''} onChange={(e) => setClientData({...clientData, clientNumber: e.target.value})} placeholder="Número" className="w-full border border-slate-300 rounded-lg p-2 text-sm" />
                    <input value={clientData.clientNeighborhood || ''} onChange={(e) => setClientData({...clientData, clientNeighborhood: e.target.value})} placeholder="Bairro" className="w-full border border-slate-300 rounded-lg p-2 text-sm" />
                    <input value={clientData.clientCity || ''} onChange={(e) => setClientData({...clientData, clientCity: e.target.value})} placeholder="Cidade" className="w-full border border-slate-300 rounded-lg p-2 text-sm" />
                    <input value={clientData.clientState || ''} onChange={(e) => setClientData({...clientData, clientState: e.target.value.toUpperCase()})} placeholder="UF" maxLength={2} className="w-full border border-slate-300 rounded-lg p-2 text-sm" />
                  </div>
                ) : <span className="font-medium text-slate-800">{sale.clientStreet ? `${sale.clientStreet}, nº ${sale.clientNumber} - ${sale.clientNeighborhood}, ${sale.clientCity}-${sale.clientState}` : sale.clientAddress || 'Não informado'}</span>}
              </div>
              {isEditingClient && <button onClick={saveClientDetails} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors">Salvar dados do cliente</button>}
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
              <h4 className="flex items-center gap-2 text-slate-800 font-bold"><Car size={18} className="text-orange-500"/> Detalhes do Veículo</h4>
              <button onClick={() => setIsEditingVehicle(prev => !prev)} className={`p-1.5 rounded-lg border transition-colors ${isEditingVehicle ? 'bg-slate-200 border-slate-400 text-slate-700' : 'bg-white border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400'}`} title="Editar dados do veículo">
                <Pencil size={14} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div><span className="block text-xs text-slate-500 font-semibold uppercase">Veículo</span>{isEditingVehicle ? <div className="grid grid-cols-2 gap-2"><input value={vehicleData.brand || ''} onChange={(e) => setVehicleData({...vehicleData, brand: e.target.value})} placeholder="Marca" className="w-full border border-slate-300 rounded-lg p-2 text-sm" /><input value={vehicleData.model || ''} onChange={(e) => setVehicleData({...vehicleData, model: e.target.value})} placeholder="Modelo" className="w-full border border-slate-300 rounded-lg p-2 text-sm" /></div> : <span className="font-bold text-slate-800 text-base">{vehicle.brand} {vehicle.model}</span>}</div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="block text-xs text-slate-500 font-semibold uppercase">Placa / Ano</span>{isEditingVehicle ? <div className="flex gap-2"><input value={vehicleData.plate || ''} onChange={(e) => setVehicleData({...vehicleData, plate: e.target.value})} placeholder="Placa" className="w-full border border-slate-300 rounded-lg p-2 text-sm font-mono" /><input value={vehicleData.year || ''} onChange={(e) => setVehicleData({...vehicleData, year: e.target.value})} placeholder="Ano" className="w-full border border-slate-300 rounded-lg p-2 text-sm" /></div> : <><span className="font-medium text-slate-800 font-mono bg-white px-1 border rounded">{vehicle.plate}</span> <span className="text-slate-600">({vehicle.year})</span></>}</div>
                <div><span className="block text-xs text-slate-500 font-semibold uppercase">Cor</span>{isEditingVehicle ? <input value={vehicleData.color || ''} onChange={(e) => setVehicleData({...vehicleData, color: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2 text-sm" /> : <span className="font-medium text-slate-800">{vehicle.color || '---'}</span>}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div><span className="block text-xs text-slate-500 font-semibold uppercase">Renavam</span>{isEditingVehicle ? <input value={vehicleData.renavam || ''} onChange={(e) => setVehicleData({...vehicleData, renavam: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2 text-sm" /> : <span className="font-medium text-slate-800">{vehicle.renavam || '---'}</span>}</div>
                <div><span className="block text-xs text-slate-500 font-semibold uppercase">CRV</span>{isEditingVehicle ? <input value={vehicleData.crv || ''} onChange={(e) => setVehicleData({...vehicleData, crv: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2 text-sm" /> : <span className="font-medium text-slate-800">{vehicle.crv || '---'}</span>}</div>
                <div><span className="block text-xs text-slate-500 font-semibold uppercase">Chassi</span>{isEditingVehicle ? <input value={vehicleData.chassis || ''} onChange={(e) => setVehicleData({...vehicleData, chassis: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2 text-sm" /> : <span className="font-medium text-slate-800 truncate block">{vehicle.chassis || '---'}</span>}</div>
              </div>
              {isEditingVehicle && <button onClick={saveVehicleDetails} className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-colors">Salvar dados do veículo</button>}
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
              <h4 className="flex items-center gap-2 text-slate-800 font-bold"><Wallet size={18} className="text-emerald-500"/> Resumo Financeiro</h4>
              <button onClick={() => setIsEditingFinancial(prev => !prev)} className={`p-1.5 rounded-lg border transition-colors ${isEditingFinancial ? 'bg-slate-200 border-slate-400 text-slate-700' : 'bg-white border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400'}`} title="Editar dados financeiros">
                <Pencil size={14} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <span className="text-slate-500 font-semibold uppercase text-xs">Valor Total</span>
                {isEditingFinancial ? (
                  <input value={financialData.saleValue || ''} onChange={(e) => setFinancialData({...financialData, saleValue: formatMoney(e.target.value)})} className="w-36 border border-slate-300 rounded-lg p-2 text-sm text-right font-semibold" />
                ) : <span className="font-bold text-slate-800 text-lg">R$ {totalValue.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>}
              </div>
              <div className="flex flex-col gap-1 border-t border-slate-200/60 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-slate-500 font-semibold uppercase text-xs">Entrada</span>
                {isEditingFinancial ? (
                  <input value={financialData.downPayment || ''} onChange={(e) => setFinancialData({...financialData, downPayment: formatMoney(e.target.value)})} className="w-32 border border-slate-300 rounded-lg p-2 text-sm text-right font-semibold" />
                ) : <span className="font-medium text-slate-800">R$ {downPayment.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>}
              </div>
              <div className="flex flex-col gap-1 border-t border-slate-200/60 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-slate-500 font-semibold uppercase text-xs">Financiado</span>
                {isEditingFinancial ? (
                  <input value={financialData.financedAmount || ''} onChange={(e) => setFinancialData({...financialData, financedAmount: formatMoney(e.target.value)})} className="w-32 border border-slate-300 rounded-lg p-2 text-sm text-right font-semibold" />
                ) : <span className="font-medium text-slate-800">R$ {parseMoney(sale.financedAmount || (totalValue - downPayment)).toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>}
              </div>
              <div className="flex flex-col gap-2 border-t border-slate-200/60 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-slate-500 font-semibold uppercase text-xs">Parcelamento</span>
                {isEditingFinancial ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <input value={financialData.installments || ''} onChange={(e) => setFinancialData({...financialData, installments: e.target.value})} type="number" className="w-full sm:w-16 border border-slate-300 rounded-lg p-2 text-sm text-right font-semibold" />
                    <input value={financialData.installmentValue || ''} onChange={(e) => setFinancialData({...financialData, installmentValue: formatMoney(e.target.value)})} className="w-full sm:w-24 border border-slate-300 rounded-lg p-2 text-sm text-right font-semibold" />
                  </div>
                ) : <span className="font-medium text-slate-800 bg-white px-2 py-1 border rounded-full text-xs inline-flex items-center self-start sm:self-auto max-w-full break-words">{installments.length}x de R$ {parseMoney(sale.installmentValue || '0').toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>}
              </div>
              {isEditingFinancial && <button onClick={saveFinancialDetails} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors">Salvar dados financeiros</button>}
            </div>
          </div>
        </div>

        {/* DOCUMENTS SECTION */}
        <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 shadow-sm">
          <h4 className="flex items-center gap-2 text-slate-800 font-bold mb-3"><FolderArchive size={18} className="text-blue-600"/> Documentos Anexados (Veículo e Cliente)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <label className="w-full cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg text-sm font-bold transition-colors text-center">
              + Anexar Documento do Veículo
              <input type="file" multiple className="hidden" onChange={handleAppendVehicleDocuments} />
            </label>
            <label className="w-full cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg text-sm font-bold transition-colors text-center">
              + Anexar Documento do Cliente
              <input type="file" multiple className="hidden" onChange={handleAppendClientDocuments} />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {vehicle.documents?.map((doc, i) => (
              <div key={'v'+i} className="grid grid-cols-[auto,minmax(0,1fr),auto,auto] items-center gap-2 sm:gap-3 bg-white border border-slate-200 px-3 py-3 rounded-xl text-sm hover:border-blue-400 hover:shadow-md transition-all group min-w-0 overflow-hidden">
                <div className="bg-blue-100 p-1.5 rounded text-blue-600 group-hover:bg-blue-50 transition-colors"><FileText size={16} /></div>
                <button onClick={() => handleDownloadDocument(doc)} className="font-medium text-slate-700 group-hover:text-blue-700 text-left min-w-0 break-all leading-tight">
                  {doc?.name || doc}
                </button>
                <button onClick={() => handleDownloadDocument(doc)} className="text-slate-400 hover:text-blue-600 p-1 rounded shrink-0">
                  <ArrowDownToLine size={16} />
                </button>
                <button onClick={() => handleRemoveVehicleDocument(i)} className="text-slate-400 hover:text-red-600 p-1 rounded shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {sale.clientDocuments?.map((doc, i) => (
              <div key={'c'+i} className="grid grid-cols-[auto,minmax(0,1fr),auto,auto] items-center gap-2 sm:gap-3 bg-white border border-slate-200 px-3 py-3 rounded-xl text-sm hover:border-indigo-400 hover:shadow-md transition-all group min-w-0 overflow-hidden">
                <div className="bg-indigo-100 p-1.5 rounded text-indigo-600 group-hover:bg-indigo-50 transition-colors"><IdCard size={16} /></div>
                <button onClick={() => handleDownloadDocument(doc)} className="font-medium text-slate-700 group-hover:text-indigo-700 text-left min-w-0 break-all leading-tight">
                  {doc?.name || doc}
                </button>
                <button onClick={() => handleDownloadDocument(doc)} className="text-slate-400 hover:text-indigo-600 ml-2 p-1 rounded">
                  <ArrowDownToLine size={16} />
                </button>
                <button onClick={() => handleRemoveClientDocument(i)} className="text-slate-400 hover:text-red-600 p-1 rounded shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {(vehicle.documents?.length || 0) + (sale.clientDocuments?.length || 0) === 0 && (
              <div className="w-full text-sm text-slate-500 italic bg-white border border-dashed border-slate-300 rounded-lg px-4 py-3">
                Ainda não há documentos anexados. Use os botões acima para adicionar novos arquivos após a venda.
              </div>
            )}
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-2">
            <div className="min-w-0"><span className="text-slate-500 font-bold uppercase text-xs tracking-wider">Evolução do Pagamento</span><div className="text-sm text-slate-600 font-medium mt-1 break-words">{paidCount} de {installments.length} parcelas pagas</div></div>
            <span className="font-bold text-blue-600 text-2xl sm:text-3xl self-start sm:self-auto shrink-0">{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-4 mb-6 overflow-hidden border border-slate-200/60 shadow-inner">
            <div className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex items-start justify-between gap-3 min-w-0">
              <div className="min-w-0"><span className="block text-slate-400 text-xs uppercase font-bold tracking-wider mb-1 break-words">Total Já Recebido</span><div className="text-xl sm:text-2xl font-bold text-emerald-600 break-words leading-tight">R$ {totalPaid.toLocaleString('pt-BR', {minimumFractionDigits:2})}</div></div>
              <CheckCircle size={32} className="text-emerald-100 hidden sm:block"/>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex items-start justify-between gap-3 min-w-0">
              <div className="min-w-0"><span className="block text-slate-400 text-xs uppercase font-bold tracking-wider mb-1 break-words">Saldo Devedor Restante</span><div className="text-xl sm:text-2xl font-bold text-orange-600 break-words leading-tight">R$ {remainingValue > 0 ? remainingValue.toLocaleString('pt-BR', {minimumFractionDigits:2}) : '0,00'}</div></div>
              <AlertCircle size={32} className="text-orange-100 hidden sm:block"/>
            </div>
          </div>
        </div>

        {/* TABLE OF PAYMENTS */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-slate-800">Cronograma de Parcelas</h3></div>
          <div className="overflow-x-auto max-h-[500px] scrollbar-thin">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-slate-50 shadow-sm z-10">
                <tr className="text-slate-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-bold border-b border-slate-200 w-12">Nº</th>
                  <th className="p-4 font-bold border-b border-slate-200">Vencimento</th>
                  <th className="p-4 font-bold border-b border-slate-200 whitespace-nowrap">Valor (R$)</th>
                  <th className="p-4 font-bold border-b border-slate-200 w-48">Status</th>
                  <th className="p-4 font-bold border-b border-slate-200">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...installments].sort((a,b) => a.number - b.number).map(inst => (
                  <tr key={inst.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-4 text-slate-500 font-bold">{inst.number}</td>
                    <td className="p-4 text-slate-700 font-medium">{new Date(inst.dueDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                    <td className="p-4 font-bold text-slate-800 whitespace-nowrap">R$ {(inst.value || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td className="p-4">
                      <div className="relative">
                        <select 
                          value={inst.status} 
                          onChange={(e) => handleStatusChange(inst.id, e.target.value)}
                          className={`appearance-none w-full pl-3 pr-8 py-2 rounded-lg text-xs font-bold uppercase tracking-wider outline-none cursor-pointer transition-colors border ${getStatusColor(inst.status)} shadow-sm`}
                        >
                          <option value="pendente" className="bg-white text-yellow-700">Pendente</option>
                          <option value="pago" className="bg-white text-green-700">Pago</option>
                          <option value="atrasado" className="bg-white text-red-700">Atrasado</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                      </div>
                    </td>
                    <td className="p-4">
                      <input type="text" placeholder="Ex: Pago em dinheiro..." value={inst.observation || ''} onChange={(e) => handleObsChange(inst.id, e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none placeholder:text-slate-400 transition-all" />
                    </td>
                  </tr>
                ))}
                {installments.length === 0 && (<tr><td colSpan="5" className="p-10 text-center text-slate-400 bg-slate-50 italic">Esta venda foi registada sem parcelamento (À vista).</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
};

const SoldKanbanView = ({ sales, vehicles, onDragStart, onDrop, onDragOver, onSaleClick, onDeleteSale, onGoToArchive }) => {
  const emDia = sales.filter(s => s.paymentStatus === 'em-dia');
  const inadimplentes = sales.filter(s => s.paymentStatus === 'inadimplente');
  const quitados = sales.filter(s => s.paymentStatus === 'quitado');

  return (
    <div className="flex-1 overflow-auto p-5 md:p-8 bg-slate-50">
      <div className="flex flex-col md:flex-row gap-6 h-full items-start pb-10">
        <KanbanColumn title="Em Dia" icon={<Clock size={20} className="text-blue-500"/>} count={emDia.length} onDrop={(e) => onDrop(e, 'em-dia')} onDragOver={onDragOver} bgClass="bg-white" borderClass="border-blue-100">
          {emDia.map(s => <SaleCard key={s.id} sale={s} vehicle={vehicles.find(v=>v.id === s.vehicleId)} onDragStart={onDragStart} onClick={() => onSaleClick(s)} onDelete={onDeleteSale} />)}
          {emDia.length === 0 && <EmptyState message="Nenhuma venda pendente em dia." />}
        </KanbanColumn>
        
        <KanbanColumn title="Inadimplentes" icon={<AlertTriangle size={20} className="text-red-500"/>} count={inadimplentes.length} onDrop={(e) => onDrop(e, 'inadimplente')} onDragOver={onDragOver} bgClass="bg-red-50/50" borderClass="border-red-200">
          {inadimplentes.map(s => <SaleCard key={s.id} sale={s} vehicle={vehicles.find(v=>v.id === s.vehicleId)} onDragStart={onDragStart} onClick={() => onSaleClick(s)} borderHover="hover:border-red-400" onDelete={onDeleteSale} />)}
          {inadimplentes.length === 0 && <EmptyState message="Nenhum cliente inadimplente." />}
        </KanbanColumn>
        
        <KanbanColumn title="Quitados" icon={<FolderArchive size={20} className="text-slate-500"/>} count={quitados.length} onDrop={(e) => onDrop(e, 'quitado')} onDragOver={onDragOver} bgClass="bg-slate-200/50" borderClass="border-slate-300 border-dashed">
          {quitados.slice(0, 4).map(s => <SaleCard key={s.id} sale={s} vehicle={vehicles.find(v=>v.id === s.vehicleId)} onDragStart={onDragStart} onClick={() => onSaleClick(s)} opacity="opacity-70 hover:opacity-100 bg-slate-100/80" onDelete={onDeleteSale} />)}
          
          {quitados.length > 0 && (
            <button onClick={onGoToArchive} className="w-full mt-2 py-3 bg-slate-300 hover:bg-slate-400 text-slate-700 hover:text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2">
              Ver {quitados.length} no Arquivo Morto
            </button>
          )}
          {quitados.length === 0 && <EmptyState message="Arraste para cá ao finalizar o pagamento." />}
        </KanbanColumn>
      </div>
    </div>
  );
};

const SaleCard = ({ sale, vehicle, onDragStart, onClick, onDelete, borderHover = "hover:border-blue-400", opacity = "" }) => (
  <div draggable onDragStart={(e) => onDragStart(e, sale)} onClick={onClick} className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:shadow-md transition-all relative group ${borderHover} ${opacity}`}>
    <button onClick={(e) => { e.stopPropagation(); onDelete(sale.id); }} className="absolute top-2 right-2 text-slate-200 hover:text-red-500 hover:bg-red-50 p-1.5 rounded z-10 transition-colors">
      <Trash2 size={16}/>
    </button>
    <div className="flex justify-between items-start mb-1 pr-6">
      <div className="font-bold text-slate-800 text-sm line-clamp-1">{vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Veículo Removido'}</div>
      <span className="text-xs font-bold text-slate-500 ml-2">{vehicle?.year}</span>
    </div>
    <div className="font-mono text-xs text-slate-400 mb-3">{vehicle?.plate}</div>
    
    <div className="flex items-center gap-1.5 text-sm text-slate-700 mb-2 font-medium">
      <Users size={14} className="text-blue-500"/> <span className="truncate">{sale.clientName}</span>
    </div>

    <div className="flex flex-wrap gap-2 mb-3">
      {(sale.installmentsList?.length || sale.installments) ? (
        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">
          {sale.installmentsList?.length || sale.installments}x de R$ {parseMoney(sale.installmentValue).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
        </span>
      ) : null}
      {(vehicle?.documents?.length > 0 || sale?.clientDocuments?.length > 0) && (
        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
          <FileText size={10}/> {(vehicle?.documents?.length || 0) + (sale?.clientDocuments?.length || 0)} anexo(s)
        </span>
      )}
    </div>

    <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-3">
      <span className="text-slate-400 font-medium flex items-center gap-1"><CalendarIcon size={12}/> {new Date(sale.saleDate).toLocaleDateString('pt-BR', {timeZone:'UTC'})}</span>
      <span className="font-bold text-emerald-600 text-sm">
        R$ {parseMoney(sale.saleValue).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
      </span>
    </div>
  </div>
);

const GlobalSearchView = ({ vehicles, sales, searchQuery, activeFilter, onDeleteVehicle, onDeleteSale, onPrint }) => {
  const searchLower = searchQuery.toLowerCase();
  
  const allItems = [];
  vehicles.forEach(v => {
    if (v.status === 'a-venda') allItems.push({ type: 'stock', item: v, vehicle: v });
  });
  sales.forEach(s => {
    const v = vehicles.find(veh => veh.id === s.vehicleId);
    allItems.push({ type: 'sale', item: s, vehicle: v });
  });

  const filteredItems = allItems.filter(data => {
    const v = data.vehicle;
    const s = data.type === 'sale' ? data.item : null;
    
    const searchMatch = 
      (v?.model||'').toLowerCase().includes(searchLower) || 
      (v?.plate||'').toLowerCase().includes(searchLower) || 
      (v?.crv||'').toLowerCase().includes(searchLower) || 
      (s?.clientName||'').toLowerCase().includes(searchLower) || 
      (s?.clientCpf||'').includes(searchLower);

    const typeMatch = activeFilter.type && v ? v.type === activeFilter.type : true;
    const yearMatch = activeFilter.year && v ? v.year.toString() === activeFilter.year : true;

    return searchMatch && typeMatch && yearMatch;
  });

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50">
      <div className="mb-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 mb-2"><Search className="text-indigo-600"/> Resultados da Consulta Central</h3>
        <p className="text-sm text-slate-500">Foram encontrados {filteredItems.length} resultados para sua busca atual.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {filteredItems.map((data, idx) => {
    const v = data.vehicle;

    if (data.type === 'stock') {
      return (
        <div key={idx} className="bg-white p-5 rounded-2xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden min-w-0">
          <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">Estoque</div>
          <div className="font-bold text-slate-800 text-lg mb-1 mt-2 line-clamp-2 break-words min-w-0">{v.brand} {v.model}</div>
          <div className="font-mono text-sm text-slate-500 mb-2 break-all">{v.plate} • {v.year}</div>
          <div className="text-xs text-slate-500 mb-4 break-all">CRV: {v.crv || '---'}</div>
          <div className="flex justify-between items-center text-sm border-t border-slate-100 pt-4">
            <span className="font-bold text-blue-600">R$ {parseMoney(v.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <div className="flex gap-2 items-center">
              <button onClick={(e) => { e.stopPropagation(); onDeleteVehicle(v.id); }} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={16} /></button>
            </div>
          </div>
          {v?.documents?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-500 mb-2 block uppercase">Documentos do Veículo</span>
              <div className="space-y-2">
                {v.documents.map((doc, i) => (
                  <button
                    key={`sv-${i}`}
                    onClick={() => handleDownloadDocument(doc)}
                    className="w-full text-left bg-blue-50 border border-blue-100 hover:bg-blue-100 text-blue-700 px-3 py-3.5 md:py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-start justify-between gap-2 min-w-0"
                  >
                    <span className="min-w-0 flex-1 break-words">{doc?.name || doc}</span>
                    <span className="shrink-0 flex items-center gap-1 self-start">
                      <ArrowDownToLine size={15} className="shrink-0" /> Baixar
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    } else {
      const s = data.item;
      const badgeColors = s.paymentStatus === 'quitado'
        ? 'bg-slate-200 text-slate-700'
        : s.paymentStatus === 'inadimplente'
        ? 'bg-red-500 text-white'
        : 'bg-emerald-500 text-white';

      return (
        <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col min-w-0">
          <div className={`absolute top-0 right-0 text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider ${badgeColors}`}>
            {s.paymentStatus === 'quitado' ? 'Arquivo Morto' : s.paymentStatus === 'inadimplente' ? 'Inadimplente' : 'Vendido (Em Dia)'}
          </div>

          <button onClick={(e) => { e.stopPropagation(); onDeleteSale(s.id); }} className="absolute top-2 right-2 text-slate-200 hover:text-red-500 hover:bg-red-50 p-1.5 rounded z-10 transition-colors mt-6">
            <Trash2 size={16} />
          </button>

          <div className="font-bold text-slate-800 text-lg mb-1 mt-2 line-clamp-2 pr-6 break-words min-w-0">
            {v ? `${v.brand} ${v.model}` : 'Veículo Removido'}
          </div>

          <div className="font-mono text-sm text-slate-400 mb-1 break-all">{v?.plate}</div>
          <div className="text-xs text-slate-500 mb-3 break-all">CRV: {v?.crv || '---'}</div>

          <div className="flex flex-col gap-1 text-sm text-slate-700 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100 min-w-0">
            <span className="font-bold flex items-start gap-1.5 min-w-0"><Users size={14} className="text-slate-400 shrink-0 mt-0.5" /> <span className="break-words min-w-0">{s.clientName}</span></span>
            <span className="text-xs text-slate-500 pl-5 break-words">{s.clientPhone}</span>
            <span className="text-xs text-slate-500 pl-5 break-words">
              {s.clientStreet ? `${s.clientStreet}, nº ${s.clientNumber || 'S/N'} - ${s.clientNeighborhood || ''}, ${s.clientCity || ''}-${s.clientState || ''}` : 'Endereço não informado'}
            </span>
          </div>

          <div className="mt-auto pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button onClick={() => onPrint(getContractHTML(s, v))} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 py-2 rounded flex justify-center items-center gap-1.5 text-xs font-bold transition-colors shadow-sm whitespace-nowrap"><FileText size={14} /> Contrato</button>
            <button onClick={() => onPrint(getSpreadsheetHTML(s, v))} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 py-2 rounded flex justify-center items-center gap-1.5 text-xs font-bold transition-colors shadow-sm whitespace-nowrap"><ArrowDownToLine size={14} /> Planilha</button>
            <button onClick={() => onPrint(getReportHTML(s, v))} className="bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 py-2 rounded flex justify-center items-center gap-1.5 text-xs font-bold transition-colors shadow-sm whitespace-nowrap"><Activity size={14} /> Relatório</button>
          </div>

          {(s.clientDocuments?.length > 0 || v?.documents?.length > 0) && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-500 mb-2 block">Documentos Anexados</span>
              <div className="flex flex-col gap-2">
                {v?.documents?.map((doc, i) => (
                  <button
                    key={'v' + i}
                    onClick={() => handleDownloadDocument(doc)}
                    className="w-full text-left bg-blue-50 border border-blue-100 hover:bg-blue-100 text-blue-700 px-3 py-3.5 md:py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-start justify-between gap-2 min-w-0"
                  >
                    <span className="min-w-0 flex-1 break-words">{doc?.name || doc}</span>
                    <span className="shrink-0 flex items-center gap-1 self-start"><ArrowDownToLine size={15} className="shrink-0" /> Baixar</span>
                  </button>
                ))}

                {s?.clientDocuments?.map((doc, i) => (
                  <button
                    key={'c' + i}
                    onClick={() => handleDownloadDocument(doc)}
                    className="w-full text-left bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 px-3 py-3.5 md:py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-start justify-between gap-2 min-w-0"
                  >
                    <span className="min-w-0 flex-1 break-words">{doc?.name || doc}</span>
                    <span className="shrink-0 flex items-center gap-1 self-start"><ArrowDownToLine size={15} className="shrink-0" /> Baixar</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
  })}

    {filteredItems.length === 0 && (
    <div className="col-span-full py-16 text-center text-slate-500 bg-white rounded-2xl border border-dashed border-slate-300">
      <Search size={48} className="mx-auto mb-4 opacity-20" />
      <p className="text-lg font-bold">Nenhum resultado encontrado na base de dados.</p>
      <p className="text-sm mt-1">Tente pesquisar por outro nome, placa ou modelo.</p>
    </div>
  )}
</div>
    </div>
  );
};

const DashboardView = ({ vehicles, sales, clients }) => {
  const stockVehicles = vehicles.filter(v => v.status === 'a-venda');
  const totalStockValue = stockVehicles.reduce((acc, v) => acc + parseMoney(v.price || '0'), 0);
  const totalSalesValue = sales.reduce((acc, s) => acc + parseMoney(s.saleValue || '0'), 0);
  const uniqueClientsCount = new Set(clients.map(c => c.clientCpf)).size;
  const inadimplentes = sales.filter(s => s.paymentStatus === 'inadimplente');

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-red-200 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3"><AlertTriangle size={32} className="text-red-100" /></div>
          <p className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-2">Inadimplentes</p>
          <h4 className="text-3xl font-bold text-red-600">{inadimplentes.length}</h4>
          <span className="text-xs font-medium text-red-400 mt-2">Contratos em atraso</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Veículos no Estoque</p>
          <h4 className="text-3xl font-bold text-slate-800">{stockVehicles.length}</h4>
          <span className="text-xs font-medium text-slate-400 mt-2">R$ {totalStockValue.toLocaleString('pt-BR', {minimumFractionDigits:2})} investidos</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Vendas Realizadas</p>
          <h4 className="text-3xl font-bold text-emerald-600">{sales.length}</h4>
          <span className="text-xs font-medium text-emerald-500 mt-2">R$ {totalSalesValue.toLocaleString('pt-BR', {minimumFractionDigits:2})} em receita</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Total de Clientes</p>
          <h4 className="text-3xl font-bold text-blue-600">{uniqueClientsCount}</h4>
          <span className="text-xs font-medium text-blue-400 mt-2">Registrados na base</span>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Activity size={20} className="text-slate-400" /> Vendas Recentes</h3>
          <div className="space-y-4">
            {[...sales].sort((a,b) => new Date(b.saleDate) - new Date(a.saleDate)).slice(0, 5).map(sale => (
              <div key={sale.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <p className="font-bold text-slate-700">{sale.clientName}</p>
                  <p className="text-xs text-slate-500">{new Date(sale.saleDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">R$ {parseMoney(sale.saleValue).toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
                </div>
              </div>
            ))}
            {sales.length === 0 && <p className="text-slate-500 text-sm italic">Nenhuma venda recente.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

const ClientsView = ({ sales, searchQuery, onShowAlert, onQuickSell }) => {
  const searchLower = searchQuery ? searchQuery.toLowerCase() : '';
  
  const clientsMap = new Map();
  sales.forEach(s => {
    if(!s.clientCpf) return;
    if(clientsMap.has(s.clientCpf)) {
      const existing = clientsMap.get(s.clientCpf);
      const docs = existing.documents || [];
      const newDocs = s.clientDocuments || [];
      existing.documents = [...new Set([...docs, ...newDocs])]; 
    } else {
      clientsMap.set(s.clientCpf, { ...s, documents: s.clientDocuments || [] });
    }
  });

  const uniqueClients = Array.from(clientsMap.values())
    .filter(c => (c.clientName||'').toLowerCase().includes(searchLower) || (c.clientCpf||'').includes(searchLower));

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {uniqueClients.map(client => (
          <div key={client.clientCpf} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow min-w-0 overflow-hidden">
            <div className="flex items-start gap-4 mb-5 border-b border-slate-100 pb-4 min-w-0">
              <div className="bg-blue-50 text-blue-600 p-3 rounded-full"><Users size={24} /></div>
              <div className="min-w-0">
                <h4 className="font-bold text-slate-800 text-lg break-words">{client.clientName}</h4>
                <div className="text-xs text-slate-500 font-medium">Cadastrado no sistema</div>
              </div>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><span className="block text-xs text-slate-400 font-semibold uppercase">CPF</span><span className="font-mono text-slate-700 break-all">{client.clientCpf}</span></div>
                <div><span className="block text-xs text-slate-400 font-semibold uppercase">RG</span><span className="text-slate-700">{client.clientRg || 'N/D'}</span></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><span className="block text-xs text-slate-400 font-semibold uppercase">Telefone</span><span className="text-slate-700 break-words">{client.clientPhone}</span></div>
                <div><span className="block text-xs text-slate-400 font-semibold uppercase">Estado Civil</span><span className="text-slate-700">{client.clientMaritalStatus || 'N/D'}</span></div>
              </div>
              <div className="pt-2 border-t border-slate-50">
                <span className="block text-xs text-slate-400 font-semibold uppercase mb-1">Endereço Completo</span>
                <span className="flex items-start gap-2 text-slate-700 leading-tight">
                  <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5"/> 
                  <span className="break-words min-w-0">{client.clientStreet ? `${client.clientStreet}, nº ${client.clientNumber} - ${client.clientNeighborhood}, ${client.clientCity}-${client.clientState}` : client.clientAddress || 'Endereço não cadastrado'}</span>
                </span>
              </div>
              
              {/* Client Documents View */}
              {client.documents && client.documents.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <span className="block text-xs text-slate-500 font-bold uppercase mb-2 flex items-center gap-1"><FolderArchive size={14} className="shrink-0"/> Documentos Pessoais</span>
                  <div className="space-y-2">
                    {client.documents.map((doc, i) => (
                      <button
                        key={i}
                        onClick={() => handleDownloadDocument(doc)}
                        className="w-full text-left bg-slate-50 border border-slate-200 hover:bg-slate-100 px-3 py-3.5 md:py-2.5 rounded-lg transition-colors flex items-start justify-between gap-2 min-w-0"
                        title="Baixar Documento"
                      >
                        <span className="text-sm font-semibold text-slate-700 min-w-0 flex-1 break-words">{doc?.name || doc}</span>
                        <span className="text-blue-600 shrink-0 flex items-center gap-1 text-sm font-bold self-start">
                          <ArrowDownToLine size={15} className="shrink-0"/> Baixar
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={() => onQuickSell(client)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <DollarSign size={16}/> Vender para este cliente
                </button>
              </div>
            </div>
          </div>
        ))}
        {uniqueClients.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
            <Users size={48} className="mb-4 opacity-50" />
            <p className="font-medium text-lg">Nenhum cliente encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const FinanceView = ({ sales }) => (
  <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50">
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
              <th className="p-4 font-semibold">Cliente</th>
              <th className="p-4 font-semibold text-right">Valor Venda</th>
              <th className="p-4 font-semibold text-right">Entrada</th>
              <th className="p-4 font-semibold text-right">Financiado</th>
              <th className="p-4 font-semibold text-center">Parcelamento</th>
            </tr>
          </thead>
          <tbody>
            {[...sales].sort((a,b) => new Date(b.saleDate) - new Date(a.saleDate)).map(sale => (
              <tr key={sale.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-4"><div className="font-bold text-slate-800">{sale.clientName}</div></td>
                <td className="p-4 text-right font-medium text-slate-700">R$ {parseMoney(sale.saleValue).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td className="p-4 text-right font-medium text-blue-600">R$ {parseMoney(sale.downPayment).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td className="p-4 text-right font-medium text-orange-600">R$ {parseMoney(sale.financedAmount).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td className="p-4 text-center">
                  {(sale.installmentsList?.length || sale.installments) ? (
                    <div>
                      <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold border border-slate-200">
                        {sale.installmentsList?.length || sale.installments}x de R$ {parseMoney(sale.installmentValue).toLocaleString('pt-BR', {minimumFractionDigits:2})}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1 uppercase">1º Venc: {sale.firstInstallmentDate ? new Date(sale.firstInstallmentDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '--'}</div>
                    </div>
                  ) : <span className="text-xs text-slate-400 italic">À vista</span>}
                </td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan="5" className="p-12 text-center text-slate-500">Nenhuma transação financeira.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const CommissionsView = ({ commissions, onToggleStatus, onDelete }) => {
  const pending = commissions.filter(c => c.status === 'pendente');
  const paid = commissions.filter(c => c.status === 'paga');
  const valPending = pending.reduce((acc, c) => acc + (c.value || 0), 0);
  const valPaid = paid.reduce((acc, c) => acc + (c.value || 0), 0);
  const valTotal = valPending + valPaid;

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50 space-y-6 md:space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-yellow-600 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
          <div className="absolute top-4 right-4 bg-yellow-500/50 p-2 rounded-lg"><TrendingUp size={24} /></div>
          <h4 className="text-yellow-100 text-sm font-semibold mb-2">A Receber</h4>
          <div className="text-4xl font-bold mb-1">R$ {valPending.toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
          <div className="text-yellow-200 text-xs">{pending.length} comissão(ões) pendente(s)</div>
        </div>
        <div className="bg-emerald-700 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
          <div className="absolute top-4 right-4 bg-emerald-600/50 p-2 rounded-lg"><TrendingUp size={24} /></div>
          <h4 className="text-emerald-100 text-sm font-semibold mb-2">Recebido</h4>
          <div className="text-4xl font-bold mb-1">R$ {valPaid.toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
          <div className="text-emerald-200 text-xs">{paid.length} comissão(ões) recebida(s)</div>
        </div>
        <div className="bg-slate-800 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
          <div className="absolute top-4 right-4 bg-slate-700/50 p-2 rounded-lg"><DollarSign size={24} /></div>
          <h4 className="text-slate-300 text-sm font-semibold mb-2">Total</h4>
          <div className="text-4xl font-bold text-blue-400 mb-1">R$ {valTotal.toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
          <div className="text-slate-400 text-xs">{commissions.length} comissão(ões) total</div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                <th className="p-4 font-semibold w-32">Data</th>
                <th className="p-4 font-semibold">Veículo</th>
                <th className="p-4 font-semibold">Cliente</th>
                <th className="p-4 font-semibold text-right">Valor Comissão</th>
                <th className="p-4 font-semibold text-center">Status</th>
                <th className="p-4 font-semibold text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {[...commissions].sort((a,b) => new Date(b.saleDate) - new Date(a.saleDate)).map(comm => (
                <tr key={comm.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 text-sm text-slate-600">{new Date(comm.saleDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                  <td className="p-4 font-bold text-slate-800">{comm.vehicleModel}</td>
                  <td className="p-4 text-sm text-slate-700">{comm.clientName}</td>
                  <td className="p-4 text-sm font-bold text-blue-600 text-right">R$ {(comm.value || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                  <td className="p-4 text-center"><span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${comm.status === 'paga' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>{comm.status}</span></td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center items-center gap-2">
                      <button onClick={() => onToggleStatus(comm.id, comm.status)} className="text-xs font-medium px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-300">{comm.status === 'paga' ? 'Marcar Pendente' : 'Marcar Paga'}</button>
                      <button onClick={() => onDelete(comm.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {commissions.length === 0 && <tr><td colSpan="6" className="p-12 text-center text-slate-500">Nenhuma comissão.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ArchiveView = ({ sales, vehicles, onSaleClick, onDeleteSale }) => {
  const quitados = sales.filter(s => s.paymentStatus === 'quitado');

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Contratos Finalizados</h3>
            <p className="text-sm text-slate-500">Todos os veículos quitados e arquivados.</p>
          </div>
          <div className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm">
            {quitados.length} Registros
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Data da Venda</th>
                <th className="p-4 font-semibold">Veículo</th>
                <th className="p-4 font-semibold">Cliente</th>
                <th className="p-4 font-semibold text-right">Valor Total</th>
                <th className="p-4 font-semibold text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {[...quitados].sort((a,b) => new Date(b.saleDate) - new Date(a.saleDate)).map(sale => {
                const vehicle = vehicles.find(v => v.id === sale.vehicleId);
                return (
                  <tr key={sale.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-sm text-slate-600 font-medium">
                      {new Date(sale.saleDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Removido'}</div>
                      <div className="text-xs text-slate-500 font-mono">{vehicle?.plate}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-700 font-medium">{sale.clientName}</td>
                    <td className="p-4 text-right font-bold text-emerald-600">
                      R$ {parseMoney(sale.saleValue).toLocaleString('pt-BR', {minimumFractionDigits:2})}
                    </td>
                    <td className="p-4 text-center flex justify-center items-center gap-2">
                      <button 
                        onClick={() => onSaleClick(sale.id)}
                        className="text-xs font-bold px-4 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        Ver Detalhes
                      </button>
                      <button onClick={() => onDeleteSale(sale.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                )
              })}
              {quitados.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-16 text-center text-slate-500">
                    <FolderArchive size={40} className="mx-auto mb-3 opacity-30" />
                    Nenhum contrato arquivado encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const formatDateTimeLabel = (value) => {
  if (!value) return 'Sem data';
  return new Date(value).toLocaleString('pt-BR');
};

const NotesView = ({ notes, searchQuery, onSaveNote, onDeleteNote, onToggleDone }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);

  const filteredNotes = [...notes]
    .filter((note) => {
      const q = (searchQuery || '').toLowerCase();
      return !q || (note.title || '').toLowerCase().includes(q) || (note.content || '').toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));

  return (
    <div className="flex-1 overflow-auto p-5 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Bloco de notas</h3>
          <p className="text-sm text-slate-500">Crie observações rápidas, marque como feito e volte depois quando precisar.</p>
        </div>
        <button onClick={() => { setSelectedNote(null); setIsModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors">
          <Plus size={18} /> Nova anotação
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredNotes.map((note) => (
          <div key={note.id} className={`bg-white border rounded-2xl p-5 shadow-sm transition-all ${note.done ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className={`font-bold text-base break-words ${note.done ? 'text-emerald-700 line-through' : 'text-slate-800'}`}>{note.title || 'Sem título'}</h4>
                <p className="text-xs text-slate-500 mt-1">Anotado em {formatDateTimeLabel(note.created_at)}</p>
                {note.updated_at && note.updated_at !== note.created_at && <p className="text-xs text-slate-400 mt-1">Última edição: {formatDateTimeLabel(note.updated_at)}</p>}
              </div>
              <button onClick={() => onToggleDone(note.id, !!note.done)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${note.done ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                {note.done ? 'Feito' : 'Pendente'}
              </button>
            </div>

            <p className="text-sm text-slate-600 mt-4 whitespace-pre-wrap break-words leading-6">{note.content || 'Sem conteúdo.'}</p>

            <div className="flex flex-col sm:flex-row gap-2 mt-5">
              <button onClick={() => { setSelectedNote(note); setIsModalOpen(true); }} className="flex-1 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold flex items-center justify-center gap-2">
                <Pencil size={16} /> Editar
              </button>
              <button onClick={() => onDeleteNote(note.id)} className="flex-1 py-2.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 font-semibold flex items-center justify-center gap-2">
                <Trash2 size={16} /> Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredNotes.length === 0 && (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500">
          Nenhuma anotação encontrada.
        </div>
      )}

      <NoteModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} initialData={selectedNote} onSave={async (data) => { await onSaveNote(data); setIsModalOpen(false); }} />
    </div>
  );
};

const NoteModal = ({ isOpen, onClose, initialData, onSave }) => {
  const [formData, setFormData] = useState({ title: '', content: '', done: false });

  useEffect(() => {
    setFormData({
      id: initialData?.id,
      title: initialData?.title || '',
      content: initialData?.content || '',
      done: !!initialData?.done
    });
  }, [initialData, isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Editar anotação' : 'Nova anotação'} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Título</label>
          <input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full border border-slate-300 rounded-xl p-3 text-sm" placeholder="Ex: Cobrar assinatura da promissória" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Anotação</label>
          <textarea value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} className="w-full min-h-[220px] border border-slate-300 rounded-xl p-3 text-sm resize-y" placeholder="Escreva livremente aqui..." />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 font-medium">
          <input type="checkbox" checked={!!formData.done} onChange={(e) => setFormData({ ...formData, done: e.target.checked })} /> Marcar como feito
        </label>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50">Cancelar</button>
          <button onClick={() => onSave(formData)} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700">Salvar anotação</button>
        </div>
      </div>
    </Modal>
  );
};

const MiscDocumentsView = ({ documents, searchQuery, onUploadDocuments, onDeleteDocument }) => {
  const [description, setDescription] = useState('');
  const filteredDocs = [...documents]
    .filter((doc) => {
      const q = (searchQuery || '').toLowerCase();
      return !q || (doc.name || '').toLowerCase().includes(q) || (doc.description || '').toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return (
    <div className="flex-1 overflow-auto p-5 md:p-8">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mb-6">
        <div className="flex items-start gap-3 mb-4">
          <ClipboardList size={20} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-lg font-bold text-slate-800">Arquivos gerais</h3>
            <p className="text-sm text-slate-500">Para documentos que não pertencem a um cliente ou veículo específico.</p>
          </div>
        </div>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 text-sm mb-3" placeholder="Descrição opcional do lote enviado" />
        <label className="w-full cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors text-center block">
          + Anexar documentos diversos
          <input type="file" multiple className="hidden" onChange={async (e) => { await onUploadDocuments(e.target.files, description); e.target.value = ''; setDescription(''); }} />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filteredDocs.map((docItem) => (
          <div key={docItem.id} className="grid grid-cols-[auto,minmax(0,1fr),auto,auto] items-center gap-2 sm:gap-3 bg-white border border-slate-200 px-3 py-3 rounded-xl text-sm shadow-sm min-w-0">
            <div className="bg-blue-100 p-2 rounded text-blue-600"><FileText size={16} /></div>
            <div className="min-w-0">
              <button onClick={() => handleDownloadDocument(docItem)} className="font-medium text-slate-700 text-left min-w-0 break-all leading-tight">{docItem.name || 'Documento'}</button>
              <div className="text-xs text-slate-500 mt-1 break-words">{docItem.description || 'Sem descrição'} • {new Date(docItem.created_at).toLocaleDateString('pt-BR')}</div>
            </div>
            <button onClick={() => handleDownloadDocument(docItem)} className="text-slate-400 hover:text-blue-600 p-1 rounded shrink-0"><ArrowDownToLine size={16} /></button>
            <button onClick={() => onDeleteDocument(docItem.id)} className="text-slate-400 hover:text-red-600 p-1 rounded shrink-0"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>

      {filteredDocs.length === 0 && (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500">
          Nenhum documento diverso encontrado.
        </div>
      )}
    </div>
  );
};

const Input = ({ label, name, type = "text", value, onChange, required, placeholder, maxLength }) => (
  <div>
    <label className="block text-sm font-semibold text-slate-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input 
      type={type} 
      name={name} 
      value={value || ''} 
      onChange={onChange} 
      required={required} 
      placeholder={placeholder} 
      maxLength={maxLength} 
      className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow text-sm" 
    />
  </div>
);
