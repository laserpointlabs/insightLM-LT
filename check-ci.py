#!/usr/bin/env python3
"""
Simple script to check GitHub Actions CI status for insightLM-LT
Uses GitHub API directly without requiring CLI tools
"""

import requests
import json
import sys
import os
from datetime import datetime, timedelta

# GitHub API configuration
GITHUB_API_URL = "https://api.github.com"
REPO_OWNER = "AVIAN-LLC"
REPO_NAME = "insightLM-LT"
BRANCH = "feature/decoupling"

def get_recent_workflows(owner, repo, token=None):
    """Get recent workflow runs"""
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/actions/runs"

    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"

    params = {
        "branch": BRANCH,
        "per_page": 10
    }

    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching workflows: {e}")
        return None

def check_ci_status():
    """Check CI status and display results"""

    print("Checking GitHub Actions CI Status for insightLM-LT")
    print("=" * 60)

    # Try to get token from environment
    token = os.getenv('GITHUB_TOKEN')

    if not token:
        print("WARNING: No GITHUB_TOKEN found. Set it with:")
        print("   export GITHUB_TOKEN=your_personal_access_token")
        print("   (Create token at: https://github.com/settings/tokens)")
        print()

    # For now, use placeholder values - you'll need to update these
    owner = REPO_OWNER
    repo = REPO_NAME

    workflows = get_recent_workflows(owner, repo, token)

    if not workflows:
        print("ERROR: Failed to fetch workflow data")
        print("This could be due to:")
        print("  - Network issues")
        print("  - Repository not found (check owner/repo names)")
        print("  - Missing/invalid GitHub token")
        return

    runs = workflows.get('workflow_runs', [])

    if not runs:
        print(f"INFO: No workflow runs found for branch '{BRANCH}'")
        return

    print(f"Recent workflow runs for {owner}/{repo} ({BRANCH}):")
    print()

    for run in runs[:5]:  # Show last 5 runs
        status = run['status']
        conclusion = run['conclusion'] or 'in_progress'
        created_at = run['created_at']
        updated_at = run['updated_at']
        run_number = run['run_number']

        # Format timestamps
        created = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        updated = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        duration = updated - created

        # Status indicators
        if status == 'completed':
            if conclusion == 'success':
                icon = "[SUCCESS]"
                color = "SUCCESS"
            elif conclusion == 'failure':
                icon = "[FAILED]"
                color = "FAILED"
            else:
                icon = "[WARNING]"
                color = conclusion.upper()
        elif status == 'in_progress':
            icon = "[RUNNING]"
            color = "RUNNING"
        else:
            icon = "[PENDING]"
            color = status.upper()

        print(f"{icon} Run #{run_number} - {color}")
        print(f"   Created: {created.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"   Duration: {duration}")
        print(f"   URL: {run['html_url']}")
        print()

def main():
    if len(sys.argv) > 1:
        if sys.argv[1] in ['--help', '-h']:
            print("Usage: python check-ci.py")
            print("Checks GitHub Actions CI status for insightLM-LT")
            print("Set GITHUB_TOKEN environment variable for authenticated access")
            sys.exit(0)

    check_ci_status()

if __name__ == "__main__":
    main()
