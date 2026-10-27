export default function TarefaAcoes({nome,editar,excluir,disabled=false}:{nome:string;editar:()=>void;excluir?:()=>void;disabled?:boolean}) {
  return <div className="inline-flex shrink-0 items-center gap-1">
    <button type="button" title="Editar tarefa" aria-label={`Editar tarefa ${nome}`} disabled={disabled} onClick={editar} className="inline-flex h-7 w-7 items-center justify-center rounded text-voia-gold-500 transition-colors hover:bg-voia-gold-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/></svg>
    </button>
    {excluir&&<button type="button" title="Excluir tarefa" aria-label={`Excluir tarefa ${nome}`} disabled={disabled} onClick={excluir} className="inline-flex h-7 w-7 items-center justify-center rounded text-voia-danger transition-colors hover:bg-voia-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg>
    </button>}
  </div>;
}
