# Team Management Specification

## ADDED Requirements

### Requirement: Team Member Roles
Organizations SHALL support two roles: Owner and Member.

#### Scenario: Owner permissions
- **WHEN** a user has Owner role in an organization
- **THEN** the user SHALL be able to manage organization settings
- **AND** the user SHALL be able to manage billing and subscriptions
- **AND** the user SHALL be able to invite and remove members
- **AND** the user SHALL be able to delete the organization

#### Scenario: Member permissions
- **WHEN** a user has Member role in an organization
- **THEN** the user SHALL be able to access organization data
- **AND** the user SHALL NOT be able to manage organization settings
- **AND** the user SHALL NOT be able to manage billing
- **AND** the user SHALL NOT be able to invite or remove members

### Requirement: Team Member Invitations
Organization owners SHALL be able to invite users to join their organization.

#### Scenario: Send invitation
- **WHEN** an organization owner invites a user by email
- **THEN** the system SHALL create an Invitation record
- **AND** the system SHALL send an invitation email
- **AND** the invitation SHALL include a unique token
- **AND** the invitation SHALL specify the role (Owner or Member)

#### Scenario: Accept invitation
- **WHEN** a user clicks the invitation link
- **THEN** the system SHALL validate the invitation token
- **AND** if valid, the system SHALL create an OrganizationMember record
- **AND** the invitation status SHALL be updated to 'accepted'
- **AND** the user SHALL gain access to the organization

#### Scenario: Invitation expiration
- **WHEN** an invitation is older than 7 days
- **THEN** the system SHALL mark it as expired
- **AND** expired invitations SHALL not be accepted
- **AND** organization owners SHALL be able to resend invitations

### Requirement: Team Member Management
Organization owners SHALL be able to manage team members.

#### Scenario: View team members
- **WHEN** an organization owner views the team page
- **THEN** the system SHALL display all members with their roles and join dates
- **AND** the system SHALL show pending invitations

#### Scenario: Remove team member
- **WHEN** an organization owner removes a team member
- **THEN** the system SHALL remove the OrganizationMember record
- **AND** the user SHALL lose access to the organization's data
- **AND** the action SHALL be logged in activity logs

#### Scenario: Update member role
- **WHEN** an organization owner changes a member's role
- **THEN** the system SHALL update the OrganizationMember record
- **AND** the member's permissions SHALL be updated accordingly
- **AND** at least one Owner SHALL always remain in the organization

#### Scenario: Prevent removing last owner
- **WHEN** an organization owner attempts to remove the last Owner
- **THEN** the system SHALL prevent the removal
- **AND** the system SHALL show an error message

### Requirement: Activity Logging
Organization activities SHALL be logged for audit purposes.

#### Scenario: Log team events
- **WHEN** a team member is invited, added, removed, or role is changed
- **THEN** the system SHALL create an ActivityLog record
- **AND** the log SHALL include user, action, timestamp, and IP address

#### Scenario: View activity logs
- **WHEN** an organization owner views activity logs
- **THEN** the system SHALL display recent activities
- **AND** logs SHALL be filterable by user, action type, and date range
