export function infoScreenHTML(): string {
	return `<!DOCTYPE HTML>
		<html lang="en" style="background-color: rgb(0, 0, 0);">
			<head>
				<title>Info screen</title>
			</head>
			<body style="margin: 0;overflow-x: hidden;">
				<info-screen>Javascript should be enabled</info-screen>
				<script type="module" src="/info-screen/info-screen.bundle.js"></script>
			</body>
		</html>`;
}
