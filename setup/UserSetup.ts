import { APIRequestContext } from '@playwright/test';

export type UserProfile = {
  email: string;
  username: string;
  bio: string | null;
  image: string | null;
};

/** The avatar Conduit assigns to a new account - the restore target when none is set. */
const DEFAULT_AVATAR = 'https://conduit-api.bondaracademy.com/images/smiley-cyrus.jpeg';

export class UserSetup {
  constructor(private readonly api: APIRequestContext) {}

  async getProfile(): Promise<UserProfile> {
    const response = await this.api.get('user');
    const body = await response.json();
    return body.user as UserProfile;
  }

  async getBio(): Promise<string | null> {
    return (await this.getProfile()).bio;
  }

  async getImage(): Promise<string | null> {
    return (await this.getProfile()).image;
  }

  async getUsername(): Promise<string> {
    return (await this.getProfile()).username;
  }

  /**
   * Restore the snapshotted fields. The password is never touched, or global-setup can no
   * longer log in. A field that started empty cannot be restored to empty: the app ignores
   * '' and null while returning 200, so a single space is the closest reachable blank.
   */
  async restoreProfile(profile: UserProfile): Promise<void> {
    await this.api.put('user', {
      data: {
        user: {
          email: profile.email,
          username: profile.username,
          bio: profile.bio || ' ',
          image: profile.image || DEFAULT_AVATAR,
        },
      },
      maxRetries: 3,
    });
  }
}
