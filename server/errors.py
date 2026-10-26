"""The one exception the API turns into an answer: what went wrong, in words for the page, with its HTTP status."""


class ApiError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message
