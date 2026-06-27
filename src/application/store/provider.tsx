'use client'

import { Provider } from 'react-redux'
import { store } from './index'
import '../../infrastructure/i18n'

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      {children}
    </Provider>
  )
}
