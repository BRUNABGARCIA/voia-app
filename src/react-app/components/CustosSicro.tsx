import { chaveCustoSicro,formatarDecimalSicro,type ReferenciaSicro } from '../../shared/sicro';

export default function CustosSicro({referencia,escolhido,onEscolher}:{referencia:ReferenciaSicro;escolhido?:string|null;onEscolher?:(key:string|null)=>void}){
 const custos=referencia.custos.filter(c=>c.selecionavel);
 return <div className="sicro-custos"><small>{({composicao:'Composição',material:'Material',equipamento:'Equipamento',mao_de_obra:'Mão de obra'})[referencia.subtipo]} · custos oficiais SICRO</small>{custos.map(c=><small key={chaveCustoSicro(c)}>{c.rotulo} · {c.edicao}: <strong>{formatarDecimalSicro(c.valor)}</strong> / {c.unidade}</small>)}{onEscolher&&<label>Custo de referência SICRO<select aria-label="Custo de referência SICRO" value={escolhido??''} onChange={e=>onEscolher(e.target.value||null)}><option value="">Escolher custo e edição</option>{custos.map(c=><option key={chaveCustoSicro(c)} value={chaveCustoSicro(c)}>{c.rotulo} · {c.edicao} · {formatarDecimalSicro(c.valor)} / {c.unidade}</option>)}</select></label>}{referencia.subtipo==='equipamento'&&!escolhido&&<small>Escolha produtivo ou improdutivo e a edição no detalhe da linha.</small>}</div>;
}
