import { extension_settings } from '../../../extensions.js';
import { event_types, eventSource, main_api, saveSettingsDebounced } from '../../../../script.js';
import { uuidv4 } from '../../../utils.js';

const extensionsHandlebars = Handlebars.create();
const extensionName = 'anlatan-nai-extras';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const defaultSettings = {
    removeLastMentionOfChar: false,
    removeExampleChatSeparators: false,
    removeCharAndUser: false,
    pruneChatBy: 0,
    textBlocks: [],
    storyString: `{{wiBefore}}
{{description}}
{{personality}}
{{persona}}
{{wiAfter}}
{{examples}}
{{scenarioBefore}}
{{scenario}}
{{scenarioAfter}}
⁂
{{preamble}}
{{instruct main}}
{{chat}}`,
};
await loadSettings();
const extensionSettings = extension_settings[extensionName];

/**
 * Save Story Format
 * @param event
 */
function onStoryStringChange(event) {
    extensionSettings.storyString = event.target.value;
    saveSettingsDebounced();
}

/**
 * Toggles removal of last character name
 * @param event
 */
function onRemoveLastMentionOfCharChange(event) {
    extensionSettings.removeLastMentionOfChar = Boolean(event.target.checked);
    saveSettingsDebounced();
}

/**
 * Saves whether example message should be squashed
 * @param event
 */
function onRemoveExampleChatSeparatorsChange(event) {
    extensionSettings.removeExampleChatSeparators = Boolean(event.target.checked);
    saveSettingsDebounced();
}

/**
 * Resets the Story Format window and settings
 * @param event
 */
function onResetStoryStringClick(event) {
    document.getElementById('anlatan-nai-extras-storystring-template').value = defaultSettings.storyString;
    extensionSettings.storyString = defaultSettings.storyString;
    saveSettingsDebounced();
}

/**
 * Adds a text block to settings and update
 * the text block list
 * @param event
 */
function onAddBlockClick(event) {
    const labelInput = document.getElementById('anlatan-nai-extras-newblock-label');
    const contentInput = document.getElementById('anlatan-nai-extras-newblock-content');

    const label = labelInput.value;
    const content = contentInput.value;

    if (!label || !content) return;

    extensionSettings.textBlocks.push({
        uuid: uuidv4(),
        label,
        content,
    });

    labelInput.value = '';
    contentInput.value = '';

    saveSettingsDebounced();
    updateTextBlocks();
}

/**
 * Removes a text block to settings and updates
 * the text block list
 * @param event
 */
function onRemoveBlockClick(event) {
    extensionSettings.textBlocks = extensionSettings.textBlocks.filter(block => event.target.parentElement.dataset.uuid !== block.uuid);
    saveSettingsDebounced();
    updateTextBlocks();
}

/**
 * Toggles removal of user and character name occurrences
 * @param event
 */
function onRemoveCharAndUserClick(event) {
    extensionSettings.removeCharAndUser = Boolean(event.target.checked);
    saveSettingsDebounced();
}

/**
 * Sets chat messages to be pruned from end of the chat
 * @param event
 */
function onChatPruneChange(event) {
    extensionSettings.pruneChatBy = Number(event.target.value);
    saveSettingsDebounced();
}

/**
 * Empties and fills the text block container.
 */
function updateTextBlocks() {
    const container = document.getElementById('anlatan-nai-extras-textblocks');
    container.innerHTML = '';
    let html = '';

    extensionSettings.textBlocks.forEach((block) => {
        html += `<div class="flex wide100p">
                    <input type="text" value="${block.label}" class="text_pole textarea_compact" placeholder="Block name" disabled/>
                    <div class="anlatan-nai-extras-removeBlock menu_button menu_button_icon" style="margin-left:1em;" data-uuid="${block.uuid}">
                        <i class="fa-xs fa-solid fa-minus"></i>
                        <small data-i18n="Remove" >Remove</small>
                    </div>
                </div>
                <textarea class="text_pole textarea_compact" placeholder="Block content" disabled>${block.content}</textarea>`;
    });

    container.insertAdjacentHTML('beforeend', html);

    Array.from(document.getElementsByClassName('anlatan-nai-extras-removeBlock')).forEach((element) => element.addEventListener('click', onRemoveBlockClick));
}

/**
 * Removes the chat-style formatting from the given chat.
 *
 * @param user
 * @param character
 * @param chat
 * @returns {*}
 */
const removeFromChat = (user, character, chat) => {
    const expression = new RegExp(`^${user}:|${character}:`, 'gm');
    return chat.replace(expression, '');
};

/**
 * Removes the last occurrence of target from the given string.
 *
 * @param target
 * @param str
 * @returns {*|string}
 */
const removeLastOccurrence = (target, str) => {
    const index = target.lastIndexOf(str);

    if (index !== -1 && index === target.length - str.length) {
        return target.substring(0, index);
    }

    return target;
};

/**
 * Whether NovelAI API is currently selected
 *
 * @returns {boolean}
 */
const isNai = () => {
    return 'novel' === main_api;
};

/**
 * Check if Advanced Formatting is set to the NovelAI preset and
 * instruct mode is disabled. Show a visual hint otherwise.
 */
const checkAdvancedFormatting = () => {
    if (!isNai) return;

    const contextTemplate = document.getElementById('context_presets').value;
    const instructEnabled = document.getElementById('instruct_enabled').checked;
    const element = document.getElementById('anlatan-nai-extras-warning');

    if ('NovelAI' !== contextTemplate || true === instructEnabled) {
        element.classList.add('anlatan-nai-extras-warning-active');
        element.textContent = 'NovelAI template not set. To prevent unwanted formatting go to Advanced Formatting, then select the NovelAI template and disable instruct mode.';
    } else {
        element.classList.remove('anlatan-nai-extras-warning-active');
        element.textContent = '';
    }
};

/**
 * Populate extension settings
 */
async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};

    const extensionKeys = Object.keys(extension_settings[extensionName]);
    const defaultKeys = Object.keys(defaultSettings);

    for (const key of defaultKeys) {
        if (!extensionKeys.includes(key)) {
            extension_settings[extensionName][key] = defaultSettings[key];
        }
    }
}

function setupHelpers() {
    function instructHelper(...args) {
        if (args && !args[0]) return '';
        args.pop();
        return args.map(item => `{ ${item} }`).join(' ');
    }

    function infoHelper(...args) {
        if (args && !args[0]) return '';
        args.pop();
        return args.map(item => item ? `----\n ${item}` : null).join('\n') + '\n***';
    }

    function bracketsHelper(...args) {
        if (args && !args[0]) return '';
        const first = args.shift();
        args.pop();
        if (!args.length) {
            return `[ ${first} ]`;
        }
        return `[ ${first}: ${args.join(', ')} ]`;
    }

    function multiBracketHelper(...args) {
        if (args && !args[0]) return '';
        args.pop();
        let output = '';
        let index = 0;
        args.forEach((value) => {
            if (index % 2 === 0) {
                output += `${args[index]}: ${args[index + 1]} ; `;
            }
            index++;
        });
        return `[ ${output.substring(0, output.length - 3)} ]`;
    }

    function knowledgeHelper(...text) {
        if (!text) return '';
        return `[ Knowledge: ${text.join(', ')} ]`;
    }

    function attgHelper(author, title, tags, genre) {
        if (!author && !title && !tags && !genre) return '';
        return `[ Author: ${author}; Title: ${title}; Tags: ${tags}; Genre: ${genre} ]`;
    }

    function styleHelper(...tags) {
        if (!tags) return '';
        tags.pop();
        return `[ Style: ${tags.join(', ')} ]`;
    }

    function newSceneHelper(text) {
        return '***';
    }

    function newStoryHelper(text) {
        return '⁂';
    }

    function enHelper() {
        return ' ';
    }

    function emHelper() {
        return ' ';
    }

    function statHelper(text) {
        return `─ ${text}`;
    }

    function trimHelper(options) {
        return options.fn(this).replace(/\s{3,}/g, ' ').replace(/\n{3,}/g, '\n').trim();
    }

    extensionsHandlebars.registerHelper('instruct', instructHelper);
    extensionsHandlebars.registerHelper('in', instructHelper);

    extensionsHandlebars.registerHelper('info', infoHelper);
    extensionsHandlebars.registerHelper('i', infoHelper);

    extensionsHandlebars.registerHelper('brackets', bracketsHelper);
    extensionsHandlebars.registerHelper('b', bracketsHelper);

    extensionsHandlebars.registerHelper('multiBracket', multiBracketHelper);
    extensionsHandlebars.registerHelper('mb', multiBracketHelper);

    extensionsHandlebars.registerHelper('knowledge', knowledgeHelper);
    extensionsHandlebars.registerHelper('k', knowledgeHelper);

    extensionsHandlebars.registerHelper('attg', attgHelper);
    extensionsHandlebars.registerHelper('a', attgHelper);

    extensionsHandlebars.registerHelper('style', styleHelper);
    extensionsHandlebars.registerHelper('s', styleHelper);

    extensionsHandlebars.registerHelper('new_scene', newSceneHelper);
    extensionsHandlebars.registerHelper('ns', newSceneHelper);

    extensionsHandlebars.registerHelper('new_story', newStoryHelper);
    extensionsHandlebars.registerHelper('nst', newStoryHelper);

    extensionsHandlebars.registerHelper('en', enHelper);
    extensionsHandlebars.registerHelper('e', enHelper);

    extensionsHandlebars.registerHelper('em', emHelper);
    extensionsHandlebars.registerHelper('m', emHelper);

    extensionsHandlebars.registerHelper('stat', statHelper);
    extensionsHandlebars.registerHelper('st', statHelper);

    extensionsHandlebars.registerHelper('trim', trimHelper);
    extensionsHandlebars.registerHelper('t', trimHelper);
}

/**
 * Entry point for extension
 */
(async function () {
    const settings = extensionSettings;

    const container = document.getElementById('novel_api-settings');
    const naiExtrasHtml = await $.get(`${extensionFolderPath}/NaiExtrasSettings.html`);

    container.insertAdjacentHTML('beforeend', naiExtrasHtml);

    const storyStringTextarea = document.getElementById('anlatan-nai-extras-storystring-template');
    const removeLastMentionOfCharToggle = document.getElementById('anlatan-nai-extras-settings-removeLastMentionOfUser');
    const removeExampleChatSeparators = document.getElementById('anlatan-nai-extras-settings-removeExampleChatSeparators');
    const resetStoryString = document.getElementById('anlatan-nai-extras-resetStoryString');
    const addBlock = document.getElementById('anlatan-nai-extras-addBlock');
    const removeCharAndUser = document.getElementById('anlatan-nai-extras-settings-removeCharAndUser');
    const chatPrune = document.getElementById('anlatan-nai-extras-chatPrune');

    storyStringTextarea.value = settings.storyString;
    removeLastMentionOfCharToggle.checked = settings.removeLastMentionOfChar;
    removeExampleChatSeparators.checked = settings.removeExampleChatSeparators;
    removeCharAndUser.checked = settings.removeCharAndUser;
    chatPrune.value = settings.pruneChatBy;

    setupHelpers();

    const orderInput = (data) => {
        if (!isNai) return;

        const storyStringTemplate = extensionsHandlebars.compile(`${settings.storyString} {{generatedPromptCache}}`, { noEscape: true });

        const chatData = structuredClone(data.finalMesSend);

        const pruneChatBy = chatPrune.value;
        if (pruneChatBy) chatData.splice(0, pruneChatBy);

        let chat = chatData
            .map((e) => `${e.extensionPrompts.join('')}${e.message}`)
            .join('')
            .trim();

        if (settings.removeCharAndUser) {
            chat = removeFromChat(data.user, data.char, chat);
        } else {
            if (settings.removeLastMentionOfChar) chat = removeLastOccurrence(chat, `${data.char}:`);
        }

        let examples = data.mesExmString;
        if (settings.removeExampleChatSeparators) examples = examples.replaceAll('***', '');

        const markers = {
            description: data.description,
            personality: data.personality,
            persona: data.persona,
            wiBefore: data.worldInfoBefore,
            wiAfter: data.worldInfoAfter,
            scenarioBefore: data.beforeScenarioAnchor,
            scenarioAfter: data.afterScenarioAnchor,
            examples,
            scenario: data.scenario,
            preamble: data.naiPreamble,
            main: data.main,
            jailbreak: data.jailbreak,
            chat,
            user: data.user,
            char: data.char,
            generatedPromptCache: data.generatedPromptCache,
        };

        settings.textBlocks.forEach((block) => {
            markers[block.label] = block.content;
        });

        data.combinedPrompt = storyStringTemplate(markers).trim();
    };

    eventSource.on(event_types.GENERATE_BEFORE_COMBINE_PROMPTS, orderInput);
    eventSource.on(event_types.GENERATE_BEFORE_COMBINE_PROMPTS, checkAdvancedFormatting);
    eventSource.on(event_types.MESSAGE_SWIPED, checkAdvancedFormatting);

    storyStringTextarea.addEventListener('change', onStoryStringChange);
    removeLastMentionOfCharToggle.addEventListener('change', onRemoveLastMentionOfCharChange);
    removeExampleChatSeparators.addEventListener('change', onRemoveExampleChatSeparatorsChange);
    resetStoryString.addEventListener('click', onResetStoryStringClick);
    addBlock.addEventListener('click', onAddBlockClick);
    removeCharAndUser.addEventListener('click', onRemoveCharAndUserClick);
    chatPrune.addEventListener('change', onChatPruneChange);

    updateTextBlocks();
})();
