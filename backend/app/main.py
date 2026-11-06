from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.deps import get_current_user
from app.api.routes.auth import router as auth_router
from app.api.routes.datasets import router as datasets_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.analysis import router as analysis_router
from app.api.routes.quality import router as quality_router
from app.api.routes.reports import router as reports_router
from app.api.routes.settings import router as settings_router
from app.core.config import settings
from app.db.session import Base, engine
from app.models.audit import AuditLog  # noqa: F401 - registers the table model
from app.models.analysis import Analysis  # noqa: F401 - registers the table model
from app.models.dataset import Dataset  # noqa: F401 - registers the table model
from app.models.dataset_version import DatasetVersion  # noqa: F401 - registers the table model
from app.models.dashboard_export import DashboardExport  # noqa: F401 - registers the table model
from app.models.email_change_challenge import EmailChangeChallenge  # noqa: F401 - registers the table model
from app.models.login_challenge import LoginChallenge # noqa: F401 - registers the table model
from app.models.password_reset_challenge import PasswordResetChallenge # noqa: F401 - registers the table model
from app.models.quality_issue import QualityIssue  # noqa: F401 - registers the table model
from app.models.report import Report  # noqa: F401 - registers the table model
from app.models.user import User # noqa: F401 - registers the table model

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def create_database_tables() -> None:
    Base.metadata.create_all(bind=engine)
    # Keep the local development database compatible when new registration
    # fields are added without requiring a destructive database reset.
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT TRUE"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS temporary_password_expires_at TIMESTAMPTZ"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE datasets "
                "ADD COLUMN IF NOT EXISTS owner_id INTEGER "
                "REFERENCES users(id) ON DELETE CASCADE"
            )
        )
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_datasets_owner_id ON datasets(owner_id)")
        )
        connection.execute(
            text(
                "ALTER TABLE dataset_versions "
                "ADD COLUMN IF NOT EXISTS missing_cells INTEGER"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS preferences JSON NOT NULL DEFAULT '{}'"
            )
        )
@app.get("/api/Check_Status")
def Health():
    return {"status": "ok"}

@app.get("/api/greet")
def greet():
    return {"message":"Welcome To Platform"}

app.include_router(auth_router, prefix="/api/auth")

app.include_router(
    datasets_router,
    prefix="/api/datasets",
    dependencies=[Depends(get_current_user)],
)
app.include_router(
    dashboard_router,
    prefix="/api/dashboard",
    dependencies=[Depends(get_current_user)],
)
app.include_router(
    analysis_router,
    prefix="/api/analysis",
    dependencies=[Depends(get_current_user)],
)
app.include_router(
    quality_router,
    prefix="/api/quality",
    dependencies=[Depends(get_current_user)],
)
app.include_router(
    reports_router,
    prefix="/api/reports",
    dependencies=[Depends(get_current_user)],
)
app.include_router(
    settings_router,
    prefix="/api/settings",
    dependencies=[Depends(get_current_user)],
)
