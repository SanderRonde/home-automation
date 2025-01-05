import path from 'path';

const HTML = (
	json: string,
	key: string,
	randomNum: string
) => `<html lang="en" style="background-color: rgb(70, 70, 70)">
	<head>
		<link rel="icon" href="/keyval/favicon.ico" type="image/x-icon" />
		<link rel="manifest" href="/keyval/static/manifest.json" />
		<link
			rel="apple-touch-icon"
			href="/keyval/static/apple-touch-icon.png"
		/>
		<meta
			name="description"
			content="An app for controlling keyval entries"
		/>
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<link rel="stylesheet" href="/keyval/antd.dark.css" />
		<title>KeyVal Switch</title>
	</head>
	<body style="margin: 0; overflow-x: hidden">
		<div id="root" json="${json.replace(/"/g, '&quot;')}" key="${key.replace(/"/g, '&quot;')}">
			Javascript should be enabled
		</div>
		<script
			type="module"
			src="/keyval/keyval.js?n=${randomNum}"
		></script>
	</body>
</html>
`;

async function getKeyVal(secretKey: string) {
	const res = await fetch('https://automation.sanderron.de/keyval/all', {
		credentials: 'include',
		method: 'POST',
		body: JSON.stringify({
			auth: secretKey,
		}),
		headers: {
			'Content-Type': 'application/json',
		},
	});
	const json = await res.json();
	return json;
}

async function main() {
	const secretKey = await Bun.file(
		path.join(__dirname, '../secrets/auth.txt')
	).text();

	Bun.serve({
		port: 3000,
		development: true,
		fetch: async (req) => {
			const url = new URL(req.url);
			const pathname = url.pathname;
			console.log(pathname);
			if (pathname === '/') {
				const keyval = await getKeyVal(secretKey);
				return new Response(
					HTML(
						JSON.stringify(keyval),
						secretKey,
						Math.random().toString()
					),
					{
						headers: { 'Content-Type': 'text/html' },
					}
				);
			}

			const basePath = path.join(__dirname, '../app/client');
			const filePath = path.join(basePath, pathname);
			const file = Bun.file(filePath);
			if (await file.exists()) {
				return new Response(file, {
					headers: {
						'Content-Type': pathname.endsWith('.js')
							? 'application/javascript'
							: pathname.endsWith('.css')
								? 'text/css'
								: pathname.endsWith('.html')
									? 'text/html'
									: pathname.endsWith('.json')
										? 'application/json'
										: pathname.endsWith('.ico')
											? 'image/x-icon'
											: pathname.endsWith('.png')
												? 'image/png'
												: 'text/plain',
					},
				});
			}

			if (pathname === '/keyval/all') {
				const keyval = await getKeyVal(secretKey);
				return new Response(JSON.stringify(keyval), {
					headers: { 'Content-Type': 'application/json' },
				});
			}

			return new Response('Not found', { status: 404 });
		},
	});

	console.log('Server is running on port 3000');
}

await main();
