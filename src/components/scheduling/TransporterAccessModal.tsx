import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, QrCode, ExternalLink, Download, Printer, Smartphone, AlertTriangle, Globe, Edit3, Save, RotateCcw, Sparkles, CheckCircle2 } from 'lucide-react';
import QRCode from 'qrcode';
import { 
  getPublicPortalUrl, 
  getCustomPublicPortalUrl, 
  saveCustomPublicPortalUrl, 
  syncPublicPortalUrlFromFirestore,
  DEFAULT_OFFICIAL_PUBLIC_URL 
} from './schedulingUtils';

interface TransporterAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPortal: () => void;
}

export const TransporterAccessModal: React.FC<TransporterAccessModalProps> = ({
  isOpen,
  onClose,
  onOpenPortal
}) => {
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const printRef = useRef<HTMLDivElement>(null);
  
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [customInputUrl, setCustomInputUrl] = useState('');
  const [portalUrl, setPortalUrl] = useState('');

  // Atualiza portalUrl ao abrir e sincroniza do Firestore
  useEffect(() => {
    if (isOpen) {
      const loadSyncUrl = async () => {
        await syncPublicPortalUrlFromFirestore();
        const currentUrl = getPublicPortalUrl();
        setPortalUrl(currentUrl);
        setCustomInputUrl(getCustomPublicPortalUrl() || currentUrl);
      };
      loadSyncUrl();
    }
  }, [isOpen]);

  const isDevUrl = portalUrl.includes('ais-dev-');

  useEffect(() => {
    if (isOpen && portalUrl) {
      QRCode.toDataURL(portalUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#1E3932',
          light: '#FFFFFF'
        }
      })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error('Erro ao gerar QR Code:', err));
    }
  }, [isOpen, portalUrl]);

  if (!isOpen) return null;

  const handleSaveCustomUrl = () => {
    saveCustomPublicPortalUrl(customInputUrl);
    const updated = getPublicPortalUrl();
    setPortalUrl(updated);
    setIsEditingUrl(false);
  };

  const handleApplyOfficialPublicUrl = () => {
    saveCustomPublicPortalUrl(DEFAULT_OFFICIAL_PUBLIC_URL);
    const updated = getPublicPortalUrl();
    setPortalUrl(updated);
    setCustomInputUrl(DEFAULT_OFFICIAL_PUBLIC_URL);
    setIsEditingUrl(false);
  };

  const handleResetUrl = () => {
    saveCustomPublicPortalUrl('');
    const reset = getPublicPortalUrl();
    setPortalUrl(reset);
    setCustomInputUrl(reset);
    setIsEditingUrl(false);
  };

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(portalUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = portalUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `*Agendamento de Carga e Descarga - Titam Logística*\n\nAcesse o link abaixo para agendar sua janela ou consultar seu protocolo:\n${portalUrl}\n\n_Acesso 100% livre pelo celular, sem necessidade de senha._`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleDownloadQR = () => {
    if (!qrCodeDataUrl) return;
    const link = document.createElement('a');
    link.download = 'qrcode-agendamento-titam.png';
    link.href = qrCodeDataUrl;
    link.click();
  };

  const handlePrintPoster = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200 my-8">
        
        {/* Header */}
        <div className="bg-titam-deep p-6 text-white flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-titam-lime/20 border border-titam-lime/40 flex items-center justify-center text-titam-lime">
              <QrCode size={26} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Canal do Transportador</h3>
              <p className="text-xs text-titam-lime/80 font-medium">Link & QR Code para Motoristas e Transportadoras</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-6">
          
          {/* Instruções Rápidas */}
          <div className="p-4 bg-emerald-50 border border-emerald-200/70 rounded-2xl flex items-start gap-3">
            <Smartphone className="text-emerald-700 mt-0.5 shrink-0" size={20} />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <strong className="block text-emerald-950 font-bold mb-0.5">Acesso 100% Autônomo e Sem Senha</strong>
              Os motoristas e transportadoras não precisam de cadastro ou senha. Basta acessar o link pelo celular ou escanear o QR Code para agendar <strong>Carga</strong> ou <strong>Descarga</strong>.
            </div>
          </div>

          {/* Área do QR Code para impressão / exibição */}
          <div ref={printRef} className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-2xl border border-gray-200/80 text-center">
            <div className="bg-white p-3 rounded-2xl shadow-md border border-gray-200">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code de Agendamento Titam"
                  className="w-48 h-48 rounded-xl object-contain mx-auto"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-gray-400 text-xs font-bold animate-pulse">
                  Gerando QR Code...
                </div>
              )}
            </div>

            <div className="mt-3">
              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-titam-lime text-titam-deep shadow-sm">
                Aponte a Câmera do Celular
              </span>
              <p className="text-xs font-bold text-gray-700 mt-1.5">
                Portal de Agendamento de Carga & Descarga
              </p>
              <p className="text-[11px] text-gray-400">
                Sistema Titam Logística Integrada
              </p>
            </div>
          </div>

          {/* ALERTA DIDÁTICO SE FOR LINK PRIVADO (ais-dev-) OU SE PRECISAR PUBLICAR */}
          {isDevUrl ? (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-xs text-amber-950 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                <span>Por que deu &quot;Sem acesso&quot; ou &quot;Página não encontrada&quot;?</span>
              </div>
              <p className="leading-relaxed text-amber-900 text-[11px]">
                O endereço atual do seu navegador (<code>ais-dev-...</code>) é um <strong>ambiente privado restrito à sua conta Google</strong>. Qualquer pessoa de fora que abrir esse link recebe &quot;Você não tem acesso a esta página&quot;.
              </p>
              
              <div className="bg-white rounded-xl p-3 border border-amber-200 space-y-2 text-[11px]">
                <p className="font-bold text-titam-deep flex items-center gap-1.5">
                  <Sparkles size={14} className="text-titam-lime fill-titam-deep" />
                  <span>Como liberar o link público para os motoristas em 3 passos:</span>
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-gray-700">
                  <li>No topo superior direito do <strong>Google AI Studio</strong>, clique no botão <strong>&quot;Share&quot;</strong> (Compartilhar).</li>
                  <li>Clique em <strong>&quot;Publish&quot;</strong> ou <strong>&quot;Update&quot;</strong> para ativar a prévia pública na nuvem.</li>
                  <li>Copie o link gerado pelo Google AI Studio e cole no botão <strong>&quot;Personalizar Link&quot;</strong> abaixo.</li>
                </ol>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleApplyOfficialPublicUrl}
                  className="flex-1 py-2 px-3 bg-titam-deep hover:bg-titam-deep/90 text-white rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all"
                  title="Aplica o endereço público oficial (necessário ter clicado em Share no topo da tela)"
                >
                  <Globe size={14} className="text-titam-lime" />
                  <span>Usar URL Pública Oficial (ais-pre-...)</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetUrl}
                  className="py-2 px-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-all"
                  title="Voltar para a URL atual deste navegador"
                >
                  <RotateCcw size={13} />
                  <span>Restaurar URL Atual</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3.5 text-xs text-emerald-900 space-y-2">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-950">Link Público Ativado para Compartilhamento</p>
                  <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                    Se você já clicou em <strong>&quot;Share&quot;</strong> no topo do Google AI Studio, este link já está ativo e pode ser aberto por qualquer motorista ou transportadora pelo WhatsApp sem login!
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-emerald-200/60">
                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 underline"
                >
                  <ExternalLink size={12} />
                  <span>Testar abertura em nova aba</span>
                </a>
              </div>
            </div>
          )}

            {/* Dica importante sobre não copiar aistudio.google.com */}
            <p className="text-[11px] text-amber-800 bg-amber-50/80 border border-amber-200/80 px-3 py-2 rounded-xl flex items-center gap-1.5">
              <span>⚠️</span>
              <span>
                <strong>Atenção:</strong> Não copie a barra de endereço que começa com <code>aistudio.google.com</code>. Use o link do sistema abaixo ou envie pelo botão do WhatsApp:
              </span>
            </p>

            {/* Link Direto com Botão de Copiar e WhatsApp */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe size={14} className="text-emerald-600" />
                  <span>Link Oficial do Portal do Transportador</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsEditingUrl(!isEditingUrl)}
                  className="text-[11px] font-bold text-titam-deep hover:text-titam-lime transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 size={13} />
                  <span>{isEditingUrl ? 'Cancelar Edição' : 'Personalizar Link'}</span>
                </button>
              </div>

            {isEditingUrl ? (
              <div className="bg-gray-50 border border-titam-lime/50 rounded-xl p-3 space-y-2">
                <p className="text-[11px] text-gray-600">
                  Cole abaixo a URL pública do seu aplicativo (ex: Cloud Run, domínio próprio ou o link gerado no botão Share):
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customInputUrl}
                    onChange={(e) => setCustomInputUrl(e.target.value)}
                    placeholder="https://seu-link-publico.run.app"
                    className="w-full bg-white border border-gray-300 text-gray-800 text-xs px-3 py-2 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-titam-lime"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCustomUrl}
                    className="px-3 py-2 bg-titam-deep text-white rounded-lg text-xs font-bold hover:bg-titam-deep/90 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Save size={14} />
                    <span>Salvar</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetUrl}
                    title="Restaurar padrão"
                    className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={portalUrl}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs px-3.5 py-2.5 rounded-xl font-mono select-all focus:outline-none focus:ring-2 focus:ring-titam-lime"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-titam-deep text-white hover:bg-titam-deep/90'
                  }`}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <span>Enviar Link via WhatsApp</span>
            </button>
          </div>

          {/* Ações de Impressão e Download */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleDownloadQR}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-gray-200 cursor-pointer"
            >
              <Download size={16} className="text-gray-600" />
              <span>Baixar Imagem QR</span>
            </button>
            <button
              type="button"
              onClick={handlePrintPoster}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-gray-200 cursor-pointer"
            >
              <Printer size={16} className="text-gray-600" />
              <span>Imprimir Cartaz</span>
            </button>
          </div>

          {/* Botão para Testar / Abrir Portal */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenPortal();
            }}
            className="w-full py-3.5 bg-titam-lime text-titam-deep hover:bg-titam-lime/90 font-black rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-titam-lime/20 cursor-pointer"
          >
            <ExternalLink size={16} />
            <span>Abrir Canal do Transportador Agora</span>
          </button>
        </div>

      </div>
    </div>
  );
};

