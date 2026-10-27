import { useState, type FormEvent } from 'react';
import { FASES_COMERCIAIS, FASE_COMERCIAL_LABEL } from '../../shared/operacao-voia';
import { STATUS_PROJETO, STATUS_PROJETO_LABEL, type Projeto } from '../lib/projeto-tipos';

export default function ProjetoEdicaoInline({projeto,comercial,onSaved,onCancel}:{projeto:Projeto;comercial:boolean;onSaved:()=>void;onCancel:()=>void}) {
  const [nome,setNome]=useState(projeto.nome),[descricao,setDescricao]=useState(projeto.descricao||'');
  const [status,setStatus]=useState(projeto.status),[fase,setFase]=useState(projeto.fase_comercial||'');
  const [prazo,setPrazo]=useState(projeto.prazo_previsto||''),[inicio,setInicio]=useState(projeto.data_inicio||'');
  const [valor,setValor]=useState(projeto.valor_contratado==null?'':(projeto.valor_contratado/100).toFixed(2));
  const [erro,setErro]=useState(''),[salvando,setSalvando]=useState(false);
  async function salvar(e:FormEvent){e.preventDefault();if(salvando)return;setErro('');
    const dados:Record<string,unknown>={};
    if(nome.trim()!==projeto.nome)dados.nome=nome.trim();
    if((descricao||null)!==(projeto.descricao||null))dados.descricao=descricao||null;
    if(status!==projeto.status)dados.status=status;
    if((prazo||null)!==(projeto.prazo_previsto||null))dados.prazo_previsto=prazo||null;
    if((inicio||null)!==(projeto.data_inicio||null))dados.data_inicio=inicio||null;
    if(comercial){if((fase||null)!==(projeto.fase_comercial||null))dados.fase_comercial=fase||null;
      const centavos=valor.trim()?Math.round(Number(valor.replace(',','.'))*100):null;
      if(centavos!==null&&(!Number.isSafeInteger(centavos)||centavos<0)){setErro('Informe um valor válido.');return;}
      if(centavos!==(projeto.valor_contratado??null))dados.valor_contratado=centavos;
    }
    if(!Object.keys(dados).length){onCancel();return;}
    if(dados.status==='cancelado'&&!window.confirm('Cancelar o projeto? Os registros e o histórico serão preservados.'))return;
    setSalvando(true);try{const r=await fetch(`/api/projetos/${projeto.id}`,{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});if(!r.ok){const d=await r.json().catch(()=>null);throw Error(d?.error||'Não foi possível salvar o projeto.');}onSaved();}catch(e){setErro(e instanceof Error?e.message:'Falha ao salvar.');}finally{setSalvando(false);}
  }
  return <form onSubmit={salvar} aria-label="Editar informações do projeto" className="voia-inline"><fieldset disabled={salvando} className="grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2">Nome do projeto<input required maxLength={200} value={nome} onChange={e=>setNome(e.target.value)}/></label><label>Status operacional<select value={status} onChange={e=>setStatus(e.target.value as Projeto['status'])}>{STATUS_PROJETO.filter(s=>comercial||s!=='cancelado'||projeto.status==='cancelado').map(s=><option key={s} value={s}>{STATUS_PROJETO_LABEL[s]}</option>)}</select></label>{comercial&&<label>Fase comercial<select value={fase} onChange={e=>setFase(e.target.value)}><option value="">Não informada</option>{FASES_COMERCIAIS.map(f=><option key={f} value={f}>{FASE_COMERCIAL_LABEL[f]}</option>)}</select></label>}<label>Data de início<input type="date" value={inicio} onChange={e=>setInicio(e.target.value)}/></label><label>Prazo do projeto<input type="date" value={prazo} onChange={e=>setPrazo(e.target.value)}/></label>{comercial&&<label>Valor contratado (R$)<input inputMode="decimal" value={valor} onChange={e=>setValor(e.target.value)}/></label>}<label className="sm:col-span-2">Descrição<textarea maxLength={2000} value={descricao} onChange={e=>setDescricao(e.target.value)}/></label></fieldset>{erro&&<p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}<div className="mt-4 flex gap-2"><button className="voia-btn-primary" disabled={salvando}>{salvando?'Salvando…':'Salvar informações'}</button><button type="button" className="voia-btn" disabled={salvando} onClick={onCancel}>Cancelar</button></div></form>;
}
