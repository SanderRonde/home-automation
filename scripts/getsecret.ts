import { Auth } from "../app/server/lib/auth";

(async () => {
	console.log(await Auth.ClientSecret.createClientSecret(parseInt(process.argv.pop()!, 10)));
})();