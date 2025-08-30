import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { InsertTimestamp } from "./actions/insert-timestamp";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. (for sensitive information)
streamDeck.logger.setLevel(LogLevel.TRACE);

// Register the InsertTimestamp() action so that it can be instantiated by the Stream Deck application.
streamDeck.actions.registerAction(new InsertTimestamp());

// Finally, connect to the Stream Deck.
streamDeck.connect();
