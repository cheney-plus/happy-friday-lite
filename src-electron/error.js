export class AppError extends Error {
  constructor(message, type = 'General') {
    super(message)
    this.name = 'AppError'
    this.type = type
  }

  static io(message) {
    return new AppError(message, 'Io')
  }

  static config(message) {
    return new AppError(message, 'Config')
  }

  static database(message) {
    return new AppError(message, 'Database')
  }

  static llm(message) {
    return new AppError(message, 'Llm')
  }

  static pdf(message) {
    return new AppError(message, 'Pdf')
  }

  static cancelled() {
    return new AppError('Request Cancelled', 'Cancelled')
  }
}
