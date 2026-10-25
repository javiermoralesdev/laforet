/* @refresh reload */
import { render } from 'solid-js/web'
import App from './App.tsx'
import { I18nProvider } from './i18n/index.tsx'

const root = document.getElementById('root')

render(() => (
    <I18nProvider>
        <App />
    </I18nProvider>
), root!)
