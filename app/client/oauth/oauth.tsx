import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Input, Button, notification } from 'antd';

const PageCenterer: React.FC<{
	children: any;
}> = props => {
	return (
		<div
			style={{
				width: '100vw',
				height: '100vh',
				display: 'flex',
				flexDirection: 'row',
				justifyContent: 'center'
			}}
		>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center'
				}}
			>
				{props.children}
			</div>
		</div>
	);
};

const Login: React.FC<{}> = () => {
	const urlParams = new URLSearchParams(window.location.search);
	const form = React.useRef<HTMLFormElement>(null);

	React.useEffect(() => {
		if (urlParams.has('errorReason')) {
			const reason = urlParams.get('errorReason');
			notification.open({
				message: 'Failed to log in',
				description: reason
			});
		}
	}, []);

	return (
		<PageCenterer>
			<div
				style={{
					maxWidth: '400px'
				}}
			>
				<form ref={form} action={'/oauth/authorize'} method="POST">
					{[
						'client_id',
						'redirect_uri',
						'response_type',
						'scope',
						'response_mode',
						'state',
						'nonce'
					].map(param => {
						if (urlParams.has(param)) {
							return (
								<Input
									name={param}
									hidden={true}
									value={urlParams.get(param) || undefined}
								/>
							);
						}
						return null;
					})}
					<Input
						style={{ marginBottom: '10px' }}
						name={'username'}
						placeholder={'Username'}
						onKeyDown={e => {
							if (e.code === 'Enter') {
								form.current?.submit();
							}
						}}
					/>
					<Input
						name={'password'}
						type={'password'}
						placeholder={'Password'}
						style={{ marginBottom: '10px' }}
						onKeyDown={e => {
							if (e.code === 'Enter') {
								form.current?.submit();
							}
						}}
					/>
					<Button
						onClick={() => {
							form.current?.submit();
						}}
						block
						type="primary"
					>
						Login
					</Button>
				</form>
			</div>
		</PageCenterer>
	);
};

ReactDOM.render(<Login />, document.getElementById('root')!);
