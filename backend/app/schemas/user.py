"""Validated request and response shapes for user registration."""

import re
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _validate_password_strength(value: str) -> str:
    if (
        not re.search(r"[A-Za-z]", value)
        or not re.search(r"\d", value)
        or not re.search(r"[^A-Za-z0-9]", value)
    ):
        raise ValueError("Password must include a letter, a number, and a special character.")
    return value


class RegistrationCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    account_type: Literal["individual", "organization"] = Field(alias="accountType")
    full_name: str = Field(alias="fullName", min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=20)
    date_of_birth: date | None = Field(default=None, alias="dateOfBirth")
    organization: str | None = Field(default=None, max_length=160)
    job_title: str | None = Field(default=None, alias="jobTitle", max_length=120)
    address: str | None = Field(default=None, max_length=500)
    identity_type: str | None = Field(default=None, alias="identityType", max_length=40)
    identity_number: str | None = Field(default=None, alias="identityNumber", max_length=80)

    @field_validator("full_name", "phone", mode="before")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank")
        return value

    @field_validator("organization", "job_title", "address", "identity_type", "identity_number", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class RegistrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    username: str
    password_reset_required: bool
    temporary_password_expires_at: datetime
    status: str
    message: str
    created_at: datetime


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username", mode="before")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("This field cannot be blank")

        return value


class LoginResponse(BaseModel):
    challenge_id: str
    email: str
    message: str


class LoginOtpVerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    challenge_id: str = Field(min_length=20, max_length=64)
    code: str = Field(pattern=r"^\d{6}$")


class LoginOtpResendRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    challenge_id: str = Field(min_length=20, max_length=64)


class LoginOtpResendResponse(BaseModel):
    message: str


class LoginOtpVerifyResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    password_reset_required: bool
    message: str


class PasswordChangeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        return _validate_password_strength(value)


class PasswordChangeResponse(BaseModel):
    message: str


class PasswordResetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr


class PasswordResetStartResponse(BaseModel):
    challenge_id: str
    message: str


class PasswordResetCompleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    challenge_id: str = Field(min_length=20, max_length=64)
    code: str = Field(pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        return _validate_password_strength(value)


class PasswordResetCompleteResponse(BaseModel):
    message: str
