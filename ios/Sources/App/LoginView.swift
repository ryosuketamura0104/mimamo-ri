import MimamoriKit
import SwiftUI

/// 見守られる側のログイン/新規登録画面。
struct LoginView: View {
    @EnvironmentObject private var auth: AuthManager

    @State private var isSignUp = false
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var isBusy = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("mimamo-ri")
                            .font(.largeTitle.bold())
                            .foregroundStyle(Color.brand)
                        Text("一人暮らしの毎日を、そっと見守る")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
                Section {
                    Picker("モード", selection: $isSignUp) {
                        Text("ログイン").tag(false)
                        Text("新規登録").tag(true)
                    }
                    .pickerStyle(.segmented)
                }
                Section {
                    if isSignUp {
                        TextField("名前(見守る側に表示されます)", text: $name)
                    }
                    TextField("メールアドレス", text: $email)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("パスワード", text: $password)
                        .textContentType(isSignUp ? .newPassword : .password)
                }
                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                            .font(.footnote)
                    }
                }
                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        if isBusy {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Text(isSignUp ? "登録する" : "ログイン")
                                .font(.headline)
                                .frame(maxWidth: .infinity, minHeight: 32)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                    .disabled(isBusy || email.isEmpty || password.isEmpty || (isSignUp && name.isEmpty))
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func submit() async {
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        do {
            if isSignUp {
                try await auth.signUp(name: name, email: email, password: password)
            } else {
                try await auth.signIn(email: email, password: password)
            }
        } catch {
            errorMessage = "失敗しました: \(error.localizedDescription)"
        }
    }
}
