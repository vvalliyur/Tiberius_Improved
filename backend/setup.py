from setuptools import setup, find_packages

setup(
    name="poker-accounting-backend",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "fastapi==0.104.1",
        "uvicorn[standard]==0.24.0",
        "supabase==2.0.0",
        "python-dotenv==1.0.0",
        "pydantic==2.5.0",
        "python-dateutil==2.8.2",
        "polars==0.20.0",
        "python-jose[cryptography]==3.3.0",
        "PyJWT==2.8.0",
    ],
)

