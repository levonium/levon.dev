(() => {
  const $ = selector => selector.startsWith('#')
    ? document.getElementById(selector.substr(1))
    : document.querySelector(selector)
  const $$ = selector => document.querySelectorAll(selector)
  const show = el => el.classList.remove('hidden')
  const hide = el => el.classList.add('hidden')

  HTMLElement.prototype.$ = selector => $(selector)
  HTMLElement.prototype.$$ = selector => $$(selector)
  HTMLElement.prototype.show = function () { show(this) }
  HTMLElement.prototype.hide = function () { hide(this) }

  const state = {
    shouldRecordCommand: false,
    shouldStartEditor: true,
    confirmQuit: false,
    openPopup: ''
  }

  const vim = $('#vim')
  const banner = vim.$('.banner')
  const editor = vim.$('.editor')
  const popup = vim.$('.popup')
  const statusBar = vim.$('.vim .status-bar')
  const colonSpan = statusBar.$('.vim .status-bar--colon')
  const commandSpan = statusBar.$('.vim .status-bar--command')
  const errorSpan = statusBar.$('.vim .status-bar--error')
  const modeSpan = statusBar.$('.vim .status-bar--mode')
  const quitSpan = statusBar.$('.vim .status-bar--q')

  // Editor.
  document.addEventListener('keyup', (e) => {
    // key === i
    if (e.key === 'i' &&
      state.shouldStartEditor && !editor.isContentEditable) {
      editor.setAttribute('contenteditable', 'true')
      editor.$('div').show()
      editor.focus()
      toggleEditorCaret()
      modeSpan.show()
      toggleErrorSpan()
      banner.hide()
      closePopup()
    }
  })
  editor.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      editor.removeAttribute('contenteditable')
      toggleEditorCaret()
      banner.show()
      exitCommandMode()
    }
  })

  // Status bar.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
      document.addEventListener('keydown', (e) => {
        if (e.code === 'Semicolon') { // Shift + Semicolon = Colon
          state.shouldRecordCommand = true
          state.shouldStartEditor = false
          toggleStatusBar()
          listenToKeyEvents(state.shouldRecordCommand)
        }
      }, { once: true })
    } else if (e.code === 'Escape') {
      closePopup()
    } else {
      state.shouldRecordCommand = false
    }
  })

  // Commands.
  function listenToKeyEvents (shouldRecordCommand) {
    let command = ''

    document.addEventListener('keydown', (e) => {
      if (shouldRecordCommand === false) return

      if (e.code in letterKeys) {
        command = `${commandSpan.innerText}${e.key}`
        updateCommand(command)
      }
      // @TODO: add ! maybe.

      if (e.code === 'Enter') {
        if (command.length === 0) return
        executeCommand(command)
        shouldRecordCommand = false
        state.shouldStartEditor = true
      }

      if (e.code === 'Escape') {
        exitCommandMode()
        shouldRecordCommand = false
        state.shouldStartEditor = true
      }

      if (e.code === 'Backspace') {
        if (command.length === 0) {
          exitCommandMode()
          shouldRecordCommand = false
          state.shouldStartEditor = true
          return
        }
        command = command.slice(0, -1)
        updateCommand(command)
      }
    })
  }
  function executeCommand (command) {
    if (legalCommands.includes(command)) {
      if (command !== 'q') {
        openPopup(command)
        state.confirmQuit = false
      } else {
        state.confirmQuit = true
        quitSpan.show()
      }
    } else if (command in secondaryCommands) {
      secondaryCommands[command].article === state.openPopup
        ? secondaryCommands[command].fn() : toggleErrorSpan(command)
    } else if (command in quitCommands) {
      state.confirmQuit ? quitCommands[command].fn() : toggleErrorSpan(command)
      state.confirmQuit = false
    } else {
      toggleErrorSpan(command)
    }
    exitCommandMode()
  }
  function updateCommand (command) {
    commandSpan.innerText = command
  }

  // Toggle wrappers.
  function toggleStatusBar () {
    [colonSpan, commandSpan].forEach(el => el.show())
    quitSpan.hide()
    toggleErrorSpan()
    toggleEditorCaret()
  }
  function exitCommandMode () {
    [modeSpan, colonSpan, commandSpan].forEach(el => el.hide())
    commandSpan.innerText = ''
    toggleEditorCaret()
  }
  function toggleErrorSpan (command = '') {
    command === '' ? errorSpan.hide() : errorSpan.show()
    errorSpan.$('.status-bar--error--command').innerText = command
  }
  function toggleEditorCaret () {
    if (editor.classList.contains('has-caret')) {
      editor.classList.remove('has-caret')
    } else {
      !editor.innerText && editor.classList.add('has-caret')
    }
  }

  // Popup.
  function openPopup (command) {
    state.openPopup = command
    popup.show()
    popup.$('.popup--wrapper').focus()
    popup.$$('article').forEach(article => article.hide())
    popup.$(`article.popup--${command}`).show()
  }
  function closePopup () {
    popup.hide()
    popup.$$('article').forEach(article => article.hide())
    state.openPopup = ''
  }

  // Blinking caret.
  function blink () {
    if (document.body.clientWidth < 813) return
    const haveCarets = $$('.has-caret')
    window.setInterval(function () {
      haveCarets.forEach(caret => {
        if (!caret.classList.contains('hidden')) {
          caret.classList.toggle('blink')
        }
      })
    }, 500)
  }
  blink()

  // Quit commands and functions.
  const qYes = () => alert('Sorry, I can\'t close the browser tab for, you\'ll have to do it yourself. Bye.')
  const qNo = () => quitSpan.hide()
  const quitCommands = {
    yes: { fn: () => qYes() },
    no: { fn: () => qNo() }
  }

  // Secondary commands and functions.
  function copyEmail () {
    const temp = document.createElement('input')
    temp.value = ['levon', 'drim.io'].join('@')
    document.body.appendChild(temp)
    temp.select()
    document.execCommand('copy')
    document.body.removeChild(temp)
  }
  function fixPhoto () {
    $('#levon').style.filter = 'unset'
  }
  function openLink () {
    const link = document.createElement('a')
    link.innerText = 'source'
    link.hide()
    link.setAttribute('href', 'https://github.com/levonium/levon.dev')
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener,noreferrer')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  function changeTheme ({ theme, colors }) {
    vim.classList.remove(theme)
    document.body.style.setProperty('--color-bg', colors.bg)
    document.body.style.setProperty('--color-font', colors.font)
    document.body.style.setProperty('--color-key', colors.key)
  }
  const lightColors = {
    bg: '#f1f1f1',
    font: '#1a1a1a',
    key: '#0037ff'
  }
  const darkColors = {
    bg: 'rgb(40, 50, 55)',
    font: '#fff',
    key: 'rgb(96, 185, 236)'
  }
  const secondaryCommands = {
    copy: { article: 'email', fn: () => copyEmail() },
    fix: { article: 'photo', fn: () => fixPhoto() },
    open: { article: 'source', fn: () => openLink() },
    'theme light': { article: 'settings', fn: () => changeTheme({ theme: 'light', colors: lightColors }) },
    'theme dark': { article: 'settings', fn: () => changeTheme({ theme: 'dark', colors: darkColors }) }
  }

  // Legal commands and letter keys.
  const legalCommands = [
    'q', 'help', 'settings', 'email', 'photo', 'source', 'offer', 'privacy', 'terms'
  ]
  const letterKeys = {
    Space: ' ',
    KeyA: 'a',
    KeyB: 'b',
    KeyC: 'c',
    KeyD: 'd',
    KeyE: 'e',
    KeyF: 'f',
    KeyG: 'g',
    KeyH: 'h',
    KeyI: 'i',
    KeyJ: 'j',
    KeyK: 'k',
    KeyL: 'l',
    KeyM: 'm',
    KeyN: 'n',
    KeyO: 'o',
    KeyP: 'p',
    KeyQ: 'q',
    KeyR: 'r',
    KeyS: 's',
    KeyT: 't',
    KeyU: 'u',
    KeyV: 'v',
    KeyW: 'w',
    KeyX: 'x',
    KeyY: 'y',
    KeyZ: 'z'
 }

  // SM screen selectors and event listeners.
  const smClosePopupButton = $('.controls--top')
  smClosePopupButton.addEventListener('click', () => {
    closePopup()
    smClosePopupButton.hide()
  })
  $$('[data-section]')
    .forEach(button => button.addEventListener('click', (e) => {
      openPopup(e.target.dataset.section)
      smClosePopupButton.show()
    }))
  $$('[data-fn]')
    .forEach(button => button.addEventListener('click', (e) => {
      const fnName = e.target.dataset.fn.replace('-', ' ')
      const fn = secondaryCommands[fnName].fn
      fn()
    }))
})()
