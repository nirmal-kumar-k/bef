import { configureStore } from '@reduxjs/toolkit'
import { logger } from '../../infrastructure/logger'

// Example reducer, replace with actual domain slices
const rootReducer = {
  app: (state = { initialized: true }, action: any) => state
}

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => 
    getDefaultMiddleware().concat((storeAPI) => (next) => (action) => {
      logger.debug('Dispatching action', action)
      return next(action)
    })
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
