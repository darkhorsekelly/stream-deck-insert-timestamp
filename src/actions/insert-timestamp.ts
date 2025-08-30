import
streamdeck,
{
	action,
	DidReceiveSettingsEvent,
	KeyDownEvent,
	SingletonAction,
} from "@elgato/streamdeck";

// We need to import "promisify" so that we can convert the "exec" function from a callback-based function to a promise-based function.
import { promisify } from "util";

// We need to import "exec" so that we can run a command line utility to insert text.
import { exec } from "child_process";

/**
 * Settings for {@link InsertTimestamp}.
 */
type TimestampSettings = {
	format?: string; // Timestamp format selected by the user
};


/**
 * Inserts the current timestamp as text.
 */
@action({ UUID: "com.darkhorsekelly.insert-timestamp.increment" })
export class InsertTimestamp extends SingletonAction<TimestampSettings> {

	/**
	 * 
	 * @param ev - Listens for the {@link SingletonAction.onDidReceiveSettings} event 
	 * - Which is emitted by Stream Deck when the settings are changed in the property UI inspector
	 */
	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<TimestampSettings>): Promise<void> | void {
		streamdeck.logger.info(`Settings changed: format = ${ev.payload.settings.format}`);
	}

	/**
	 * Listens for the {@link SingletonAction.onKeyDown} event which is emitted by Stream Deck when an action is pressed. Stream Deck provides various events for tracking interaction
	 * with devices including key down/up, dial rotations, and device connectivity, etc. When triggered, {@link ev} object contains information about the event including any payloads
	 * and action information where applicable. 
	 */
	override async onKeyDown(ev: KeyDownEvent<TimestampSettings>): Promise<void> {
		try {
			// Get format from settings (default to "short" if not set)
			const format = ev.payload.settings?.format || "default";

			// Get the current timestamp
			const timestamp = this.getFormattedTimestamp(format);

			streamdeck.logger.info(`Got timestamp: ${timestamp} (format: ${format})`);

			// Insert timestamp
			await this.copyPasteText(timestamp);

			// Log success on the Stream Deck button
			await ev.action.showOk();

		} catch (error) {
			streamdeck.logger.error(`Error getting timestamp: ${error}`);
		}
	}

	private getFormattedTimestamp(format: string): string {
		const now = new Date();

		switch (format) {
			case "short":
				return now.toLocaleDateString();
			case "long":
				return now.toLocaleString('en-US',
					{
						weekday: 'long',
						year: 'numeric',
						month: 'long',
						day: 'numeric',
						hour: 'numeric',
						minute: '2-digit',
						second: '2-digit',
					});
			case "time":
				// just time
				return now.toLocaleTimeString();

			case "iso":
				// ISO
				return now.toISOString();

			case "custom":
                // Custom format: YYYY-MM-DD HH-MM-SS (in local time)
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');  // Months are 0-indexed
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                
                return `${year}-${month}-${day} ${hours}-${minutes}-${seconds}`;

			default:
				// short
				return now.toLocaleDateString();
		}
	}

	/** 
	 * Async function. Infers platform and copy/pastes the given text.
	*/
	private async copyPasteText(text: string): Promise<void> {
		// Use "promisify" to convert the "exec" function from a callback-based function to a promise-based function
		const execAsync = promisify(exec);


		if (process.platform === "win32") {
			try {
				// check
				streamdeck.logger.info("Inserting timestamp on Windows");
				const escapedText = text
					.replace(/`/g, '``') // escape backticks`
					.replace(/\$/g, '`$') // escape dollar signs $
					.replace(/"/g, '`"')  // escape double quotes "
					.replace(/'/g, "''") // escape single quotes '
					.replace(/\\/g, '\\\\'); // escape backslashes \'

				// check
				streamdeck.logger.info("Escaped text: " + escapedText);

				// We need to use "powershell" to run the "Set-Clipboard" command to set the clipboard to the current timestamp, and then use "SendKeys" to paste the clipboard contents.
				const command = `powershell -command "Set-Clipboard -Value '${escapedText}'; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`;

				streamdeck.logger.info("Running command: " + command);

				// Run the command
				await execAsync(command);

			} catch (error) {
				streamdeck.logger.error(`Error inserting timestamp on Windows: ${error}`);
				throw new Error(`Error inserting timestamp on Windows: ${error}`);
			}
		}
		else if (process.platform === "darwin") {
			try {
				// macOS
				// escape any double quotes in the text so that it can be passed to the command line.
				await execAsync(`echo -n "${text.replace(/"/g, '\\"')}" | pbcopy`);
				const script = `tell application "System Events" to keystroke "v" using command down`;
				await execAsync(`osascript -e '${script}'`);
			} catch (error) {
				streamdeck.logger.error(`Error inserting timestamp on macOS: ${error}`);
				throw new Error(`Error inserting timestamp on macOS: ${error}`);
			}
		} else {
			// Linux
			try {
				// We try to use "xclip" to set the clipboard to the current timestamp
				// and then use "xdotool" to paste the clipboard contents.

				await execAsync(`echo -n "${text.replace(/"/g, '\\"')}" | xclip -selection clipboard`);

				await execAsync("xdotool key ctrl+v");
			} catch (error) {
				streamdeck.logger.warn("Linux support requires xclip/xdotool");
				throw new Error("Linux support requires xclip/xdotool. Please install these utilities and try again.");
			}
		}
	}
}
