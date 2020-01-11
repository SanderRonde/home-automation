declare class PaperRipple {
	constructor(config?: {
		initialOpacity?: number;
		opacityDecayVelocity?: number;
		recenters?: boolean;
		center?: boolean;
		round?: boolean;
		target?: HTMLElement;
	});
	$: HTMLElement;
	downAction(event: MouseEvent): void;
	upAction(): void;
}

function initRipple() {
	Array.from(document.querySelectorAll('.rippleTarget')).forEach(
		(rippleTarget: HTMLElement) => {
			const ripple = new PaperRipple();
			rippleTarget.appendChild(ripple.$);

			rippleTarget.addEventListener('mousedown', e => {
				ripple.downAction(e);
			});
			rippleTarget.addEventListener('mouseup', () => {
				ripple.upAction();
			});
		}
	);
}

interface Window {
	ws: WebSocket;
}

function initListeners() {
	['volumeDown', 'volumeUp', 'playpause', 'close', 'play', 'pause'].forEach(
		externalEvent => {
			document
				.getElementById(externalEvent)!
				.addEventListener('click', () => {
					fetch(`/remote-control/${externalEvent}`, {
						method: 'POST',
						credentials: 'include'
					});
				});
		}
	);
}

function initOfflineIndicator() {
	window.addEventListener('online', () => {
		document.getElementById('networkStatus')!.classList.remove('visible');
	});
	window.addEventListener('offline', () => {
		document.getElementById('networkStatus')!.classList.add('visible');
	});
}

function initSetVolume() {
	function hideDialog() {
		document.body.classList.remove('showDialog');
	}

	document.getElementById('setVolume')!.addEventListener('click', () => {
		document.body.classList.add('showDialog');
	});

	document.getElementById('overlay')!.addEventListener('click', () => {
		hideDialog();
	});
	document.getElementById('cancelButton')!.addEventListener('click', () => {
		hideDialog();
	});
	document.getElementById('okButton')!.addEventListener('click', () => {
		hideDialog();
		const dialogInput = document.getElementById(
			'dialogInput'
		) as HTMLInputElement;
		const amount = dialogInput.value;
		dialogInput.value = '';

		fetch(`/remote-control/setvolume/${amount}`, {
			method: 'POST',
			credentials: 'include'
		});
	});
}

initRipple();
initSetVolume();
initListeners();
initOfflineIndicator();
