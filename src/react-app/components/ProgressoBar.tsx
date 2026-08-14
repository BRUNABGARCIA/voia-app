export default function ProgressoBar({ valor, compacta = false }: { valor: number; compacta?: boolean }) {
	return (
		<div className={`w-full overflow-hidden rounded-full bg-voia-neutral-100 ${compacta ? "h-1.5" : "h-2"}`}>
			<div className="h-full rounded-full bg-voia-gold-500 transition-all" style={{ width: `${valor}%` }} />
		</div>
	);
}
