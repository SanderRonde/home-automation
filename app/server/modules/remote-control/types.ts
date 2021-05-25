export type Commands =
	| {
			action: 'play' | 'pause' | 'playpause' | 'close';
	  }
	| {
			action: 'volumeUp' | 'volumeDown';
			amount?: number;
	  }
	| {
			action: 'setVolume';
			amount: number;
	  };
