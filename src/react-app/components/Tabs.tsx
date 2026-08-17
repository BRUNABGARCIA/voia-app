export interface TabItem {
	key: string;
	label: string;
}

export default function Tabs({
	abas,
	ativa,
	onChange,
}: {
	abas: TabItem[];
	ativa: string;
	onChange: (key: string) => void;
}) {
	return (
		<div className="flex gap-1 overflow-x-auto border-b border-voia-neutral-100">
			{abas.map((aba) => (
				<button
					key={aba.key}
					type="button"
					onClick={() => onChange(aba.key)}
					className={`shrink-0 rounded-t-control border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
						ativa === aba.key
							? "border-voia-gold-500 text-voia-green-900"
							: "border-transparent text-voia-neutral-500 hover:text-voia-neutral-900"
					}`}
				>
					{aba.label}
				</button>
			))}
		</div>
	);
}
