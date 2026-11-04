"""Account and dashboard preference request and response shapes."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


Theme = Literal["light", "dark"]
TextSize = Literal["small", "default", "large"]
ContrastMode = Literal["standard", "high"]
HomeSample = Literal["rainfall", "cpi", "market", "education", "health", "aqi"]
LandingPage = Literal["home", "dashboard"]
AnalysisView = Literal["overview", "activity", "summary"]
TimeRange = Literal["all", "7", "30"]
ReportFormat = Literal["pdf", "xlsx"]


class UserSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    theme: Theme | None = None
    text_size: TextSize | None = None
    contrast_mode: ContrastMode | None = None
    reduce_motion: bool | None = None
    default_landing_page: LandingPage | None = None
    home_featured_sample: HomeSample | None = None
    dashboard_default_dataset_id: int | None = Field(default=None, ge=1)
    dashboard_analysis_view: AnalysisView | None = None
    dashboard_time_range: TimeRange | None = None
    dashboard_report_format: ReportFormat | None = None

    @field_validator(
        "theme",
        "text_size",
        "contrast_mode",
        "reduce_motion",
        "default_landing_page",
        "home_featured_sample",
        "dashboard_analysis_view",
        "dashboard_time_range",
        "dashboard_report_format",
        mode="before",
    )
    @classmethod
    def reject_null_preferences(cls, value):
        if value is None:
            raise ValueError("This setting cannot be empty.")
        return value


class UserProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=1, max_length=20)
    organization: str | None = Field(default=None, max_length=160)
    job_title: str | None = Field(default=None, max_length=120)

    @field_validator("full_name", "phone")
    @classmethod
    def reject_blank_profile_fields(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be empty.")
        return value

    @field_validator("organization", "job_title")
    @classmethod
    def normalize_optional_profile_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class EmailChangeStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    new_email: EmailStr
    current_password: str = Field(min_length=8, max_length=128)


class EmailChangeVerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    challenge_id: str = Field(min_length=20, max_length=64)
    code: str = Field(pattern=r"^\d{6}$")


class EmailChangeStartResponse(BaseModel):
    challenge_id: str
    masked_email: str
    message: str


class EmailChangeResponse(BaseModel):
    email: EmailStr
    message: str
    notification_sent: bool


class AccountDeletionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=8, max_length=128)
    confirmation_name: str = Field(min_length=1, max_length=120)


class AccountDeletionResponse(BaseModel):
    message: str
    notification_sent: bool
    storage_cleanup_complete: bool


class UserSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    full_name: str
    email: str
    username: str | None = None
    phone: str
    account_type: str
    organization: str | None = None
    job_title: str | None = None
    account_status: str
    account_created_at: datetime
    theme: Theme = "light"
    text_size: TextSize = "default"
    contrast_mode: ContrastMode = "standard"
    reduce_motion: bool = False
    default_landing_page: LandingPage = "home"
    home_featured_sample: HomeSample = "rainfall"
    dashboard_default_dataset_id: int | None = None
    dashboard_analysis_view: AnalysisView = "overview"
    dashboard_time_range: TimeRange = "all"
    dashboard_report_format: ReportFormat = "pdf"
