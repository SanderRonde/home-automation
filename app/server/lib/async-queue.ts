interface QueueItem {
	next: null | QueueItem;
	start: () => unknown;
}

export class AsyncQueue {
	private lastQueueItem: null | QueueItem = null;

	public isEmpty(): boolean {
		return this.lastQueueItem === null;
	}

	/**
	 * The given callback will be called once the item is ready to start,
	 * which could be immediately if the queue is empty, or after an unknown amount of time once it's ready.
	 *
	 * The Promise returned from this function will resolve or reject when this item has completed or thrown an error.
	 */
	public addItem = async <T = unknown>(callback: () => Promise<T>): Promise<T> => {
		return new Promise((resolve, reject) => {
			const previousQueueItem = this.lastQueueItem;
			const newItem: QueueItem = {
				next: null,
				start: () => {
					const next = () => {
						// If there is a next item, start it.
						// If there isn't, then this item is the last queue item, and we can unset ourselves.
						if (newItem.next) {
							newItem.next.start();
						} else {
							this.lastQueueItem = null;
						}
					};
					callback()
						.then((result) => {
							resolve(result);
							next();
						})
						.catch((error) => {
							reject(error);
							next();
						});
				},
			};
			this.lastQueueItem = newItem;

			// If there is no active queue item, then begin.
			// Otherwise, wait for the previous queue item to complete.
			if (!previousQueueItem) {
				newItem.start();
			} else {
				previousQueueItem.next = newItem;
			}
		});
	};

	public clear = (): void => {
		this.lastQueueItem = null;
	};
}
