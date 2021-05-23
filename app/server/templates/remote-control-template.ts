import { html } from './template-join';

export function remoteControlHTML(randomNum: number): string {
	// This is just here for syntax highlighting
	return html`
		<!DOCTYPE html>
		<html>
			<head>
				<meta charset="utf-8" />
				<title>Remote control</title>
				<link
					rel="stylesheet"
					href="/remote-control/paper-ripple.min.css?n=${randomNum}"
				/>
				<link
					rel="stylesheet"
					href="/remote-control/page.css?n=${randomNum}"
				/>
				<link
					rel="manifest"
					href="/remote-control/manifest.json?n=${randomNum}"
				/>
				<link rel="icon" href="/remote-control/favicon.ico" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1, maximum-scale=1"
				/>
				<meta name="theme-color" content="#f44336" />
			</head>
			<body>
				<div id="dialogContainer">
					<div id="dialogVerticalCenterer">
						<div id="dialogHorizontalCenterer">
							<div id="dialog">
								<div id="dialogTitle">Set volume</div>
								<input
									type="number"
									id="dialogInput"
									label="volume"
									placeholder="volume"
								/>
								<div id="dialogButtons">
									<div
										class="rippleTarget blueRipple"
										id="cancelButton"
									>
										Cancel
									</div>
									<div
										class="rippleTarget blueRipple"
										id="okButton"
									>
										Ok
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div id="overlay"></div>
				<div id="main">
					<div id="navigationRow">
						<div id="topNavRow">
							<div class="rippleTarget" id="setVolume">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									xmlns:xlink="http://www.w3.org/1999/xlink"
									version="1.1"
									width="24"
									height="24"
									viewbox="0 0 24 24"
								>
									<path d="M7,9V15H11L16,20V4L11,9H7Z"></path>
								</svg>
							</div>
							<div class="rippleTarget" id="up">
								<svg
									fill="#000000"
									height="24"
									viewbox="0 0 24 24"
									width="24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"
									></path>
									<path d="M0 0h24v24H0z" fill="none"></path>
								</svg>
							</div>
							<div class="rippleTarget" id="close">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
								>
									<path
										d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
									/>
									<path d="M0 0h24v24H0z" fill="none" />
								</svg>
							</div>
						</div>
						<div id="centerNavRow">
							<div class="rippleTarget" id="left">
								<svg
									fill="#000000"
									height="24"
									viewbox="0 0 24 24"
									width="24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M15.41 16.09l-4.58-4.59 4.58-4.59L14 5.5l-6 6 6 6z"
									></path>
									<path d="M0-.5h24v24H0z" fill="none"></path>
								</svg>
							</div>
							<div class="rippleTarget" id="toggleVideo">
								<svg
									fill="#000000"
									height="24"
									viewbox="0 0 24 24"
									width="24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"
									></path>
									<path d="M0 0h24v24H0z" fill="none"></path>
								</svg>
							</div>
							<div class="rippleTarget" id="right">
								<svg
									fill="#000000"
									height="24"
									viewbox="0 0 24 24"
									width="24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M8.59 16.34l4.58-4.59-4.58-4.59L10 5.75l6 6-6 6z"
									></path>
									<path
										d="M0-.25h24v24H0z"
										fill="none"
									></path>
								</svg>
							</div>
						</div>
						<div id="bottomNavRow">
							<div class="rippleTarget" id="down">
								<svg
									fill="#000000"
									height="24"
									viewbox="0 0 24 24"
									width="24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M7.41 7.84L12 12.42l4.59-4.58L18 9.25l-6 6-6-6z"
									></path>
									<path
										d="M0-.75h24v24H0z"
										fill="none"
									></path>
								</svg>
							</div>
						</div>
					</div>
					<div id="playPauseRow">
						<div id="play" class="rippleTarget">
							<svg
								fill="#000000"
								height="24"
								viewbox="0 0 24 24"
								width="24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path d="M8 5v14l11-7z"></path>
								<path d="M0 0h24v24H0z" fill="none"></path>
							</svg>
						</div>
						<div id="pause" class="rippleTarget">
							<svg
								fill="#000000"
								height="24"
								viewbox="0 0 24 24"
								width="24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"
								></path>
								<path d="M0 0h24v24H0z" fill="none"></path>
							</svg>
						</div>
					</div>
					<div id="volumeRow">
						<div class="rippleTarget" id="volumeDown">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
							>
								<path
									d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"
								/>
								<path d="M0 0h24v24H0z" fill="none" />
							</svg>
						</div>
						<div class="rippleTarget" id="playpause">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								xmlns:xlink="http://www.w3.org/1999/xlink"
								aria-hidden="true"
								focusable="false"
								width="1em"
								height="1em"
								style="-ms-transform: rotate(360deg); -webkit-transform: rotate(360deg); transform: rotate(360deg);"
								preserveAspectRatio="xMidYMid meet"
								viewBox="0 0 24 24"
							>
								<path d="M3 5v14l8-7m2 7h3V5h-3m5 0v14h3V5" />
							</svg>
						</div>
						<div class="rippleTarget" id="volumeUp">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								xmlns:xlink="http://www.w3.org/1999/xlink"
								version="1.1"
								width="24"
								height="24"
								viewbox="0 0 24 24"
							>
								<path
									d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"
								></path>
							</svg>
						</div>
					</div>
				</div>
				<div id="statusContainer">
					<div id="scrollableContainer">
						<div id="statusType"></div>
						<div id="statusDivider">-</div>
						<div id="status"></div>
					</div>
					<div id="networkStatus">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
						>
							<path d="M0 0h24v24h-24z" fill="none"></path>
							<path
								d="M23.64 7c-.45-.34-4.93-4-11.64-4-1.5 0-2.89.19-4.15.48l10.33 10.32 5.46-6.8zm-6.6 8.22l-13.77-13.78-1.27 1.28 2.05 2.06c-2.14.98-3.46 2.04-3.69 2.22l11.63 14.49.01.01.01-.01 3.9-4.86 3.32 3.32 1.27-1.27-3.46-3.46z"
							></path>
						</svg>
					</div>
				</div>
				<script src="/remote-control/paper-ripple.min.js?n=${randomNum}"></script>
			</body>
			<script src="/remote-control/page.js?n=${randomNum}"></script>
		</html>
	`;
}
