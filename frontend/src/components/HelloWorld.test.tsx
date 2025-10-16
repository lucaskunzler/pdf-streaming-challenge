import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HelloWorld } from './HelloWorld'

describe('HelloWorld', () => {
  it('displays hello world message', () => {
    render(<HelloWorld />)
    
    expect(screen.getByText('Hello, PDF Streaming World!')).toBeInTheDocument()
  })

  it('displays project name', () => {
    render(<HelloWorld />)
    
    expect(screen.getByText(/PDF Streaming Challenge/i)).toBeInTheDocument()
  })
})
