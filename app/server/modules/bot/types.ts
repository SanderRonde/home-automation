import * as express from 'express';

export const enum RESPONSE_TYPE {
	MARKDOWN = 'Markdown',
	HTML = 'HTML',
	TEXT = 'Text',
}

interface TelegramImage {
	photo: {
		file_id: string;
		file_size: number;
		width: number;
		height: number;
	}[];
}

interface TelegramVoice {
	voice: {
		duration: number;
		mime_type: string;
		file_id: string;
		file_size: number;
	};
}

interface TelegramDocument {
	document: {
		file_name: string;
		mime_type: string;
		file_id: string;
		file_size: number;
	};
}

export interface TelegramText {
	text: string;
}

type TelegramReply<
	C = TelegramText | TelegramImage | TelegramVoice | TelegramDocument,
> = {
	reply_to_message: TelegramMessage<C>;
} & TelegramText;

export type TelegramMessage<
	C =
		| TelegramReply
		| TelegramText
		| TelegramImage
		| TelegramVoice
		| TelegramDocument,
> = {
	message_id: number;
	from: {
		id: number;
		is_bot: boolean;
		first_name: string;
		last_name: string;
		language_code: string;
	};
	chat: {
		id: number;
		first_name: string;
		last_name: string;
		type: 'private';
	};
	date: number;
} & C;

interface TelegramReqBody {
	message: TelegramMessage;
	edited_message: TelegramMessage;
}

export interface TelegramReq extends express.Request {
	body: TelegramReqBody;
}

export interface MatchResponse {
	end: number;
	response:
		| string
		| number
		| {
				type: RESPONSE_TYPE;
				text: string | number;
		  };
}
