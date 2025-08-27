export function configHTML(): string {
	return `<!DOCTYPE HTML>
		<html lang="en" style="background-color: #000;">
		<head>
			<link rel="icon" href="/config/favicon.ico" type="image/x-icon" />
			<meta
				name="description"
				content="Configuration page"
			/>
			<meta name="viewport" content="width=device-width, initial-scale=1" />
			<title>Config</title>
		</head>
		<body style="margin: 0; overflow-x: hidden">
			<div id="root">
				Javascript should be enabled
			</div>
			<script
				type="module"
				src="/config/config.js"
			></script>
		</body>
	</html>`;
}
