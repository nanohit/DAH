User interface

The user interface in tldraw includes the menus, toolbars, keyboard shortcuts, and analytics events in the editor.
Hiding the UI

You can hide the default tldraw user interface entirely using the hideUi prop. This turns off both the visuals as well as the keyboard shortcuts.

function Example() {
	return <Tldraw hideUi />
}

Here's an example of what that looks like. Note that while you can't select any other tools using the keyboard shortcuts, you can still use the setCurrentTool method to change the tool. If you open the console and enter:

editor.setCurrentTool('draw')

...then you can start drawing.

All of our user interface works by controlling the editor via its Editor methods. If you hide the user interface, you can still use these same editor's methods to control the editor. Our custom user interface example shows this in action.

The source for these examples are available in the tldraw repository or on our website.
Events

The Tldraw component has a prop, onUiEvent, that the user interface will call when certain events occur.

function Example() {
	function handleEvent(name, data) {
		// do something with the event
	}

	return <Tldraw onUiEvent={handleEvent} />
}

The onUiEvent callback is called with the name of the event as a string and an object with information about the event's source (e.g. menu or context-menu) and possibly other data specific to each event, such as the direction in an align-shapes event.

Note that onUiEvent is only called when interacting with the user interface. It is not called when running commands manually against the app, e.g. calling Editor.alignShapes will not call onUiEvent.

See the tldraw repository for an example of how to customize tldraw's user interface.
Overrides

The content of tldraw's menus can be controlled via the overrides prop. This prop accepts a TLUiOverrides object, which has methods for each part of the user interface, such as the toolbar or keyboardShortcutsMenu.
Actions

The user interface has a set of shared actions that are used in the menus and keyboard shortcuts. These actions can be overridden by passing a new set of actions to the overrides.actions method.

To create, update, or delete actions, provide an actions method that receives both the editor and the default actions and returns a mutated actions object.

const myOverrides: TLUiOverrides = {
	actions(editor, actions) {
		// You can delete actions, but remember to
		// also delete the menu items that reference them!
		delete actions['insert-embed']

		// Create a new action or replace an existing one
		actions['my-new-action'] = {
			id: 'my-new-action',
			label: 'My new action',
			readonlyOk: true,
			kbd: 'cmd+u,ctrl+u',
			onSelect(source: any) {
				// Whatever you want to happen when the action is run
				window.alert('My new action just happened!')
			},
		}
		return actions
	},
}

The actions object is a map of TLUiActionItems, with each item keyed under its id.
Tools

Tools work in the same manner as actions. You can override the default tools by passing a tools method that accepts the default tools object and returns a mutated version of that object.

const myOverrides: TLUiOverrides = {
	tools(editor, tools) {
		// Create a tool item in the ui's context.
		tools.card = {
			id: 'card',
			icon: 'color',
			label: 'tools.card',
			kbd: 'c',
			onSelect: () => {
				// Whatever you want to happen when the tool is selected.
				editor.setCurrentTool('card')
			},
		}
		return tools
	},
}

The tools object is a map of TLUiToolItems, with each item keyed under its id.
Translations

The translations method accepts a table of new translations. For example, if you wanted a tool to reference a key "tools.card", then you should at minimum provide an english translation for this key.

const myOverrides: TLUiOverrides = {
	translations: {
		en: {
			'tools.card': 'Card',
		},
	},
}