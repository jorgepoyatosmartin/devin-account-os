import getpass
import sys

import bcrypt


def main() -> None:
    password = sys.stdin.readline().rstrip("\n") if not sys.stdin.isatty() else getpass.getpass("Password: ")
    if not password:
        raise SystemExit("Password cannot be empty")
    print(bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode())


if __name__ == "__main__":
    main()
